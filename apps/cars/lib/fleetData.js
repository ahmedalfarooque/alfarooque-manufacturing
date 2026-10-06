'use strict';

/* Server-side loaders shared by the Insurance / Inspection / Alerts / Stats
   / vehicle-detail routes, so every page reads the same vehicle set and
   the same notification state. */

const { getDb } = require('./db');
const { isSchemaMissing, DEFAULT_TYPE_SETTINGS, TYPES } = require('./alertStore');
const { buildVehicleExpiry, collectAlerts, summarizeFleet, todayInZone } = require('./fleetExpiry');

async function loadActiveVehicles(sb = getDb()) {
  const { data, error } = await sb.from('cars').select('*').eq('is_active', true).order('vehicle_number', { ascending: true });
  if (error) { const e = new Error('Could not load vehicles.'); e.cause = error; throw e; }
  return data || [];
}

const NOT_READY = () => ({ ready: false, settings: null, recipientCount: {}, byKey: new Map(), todayDeliveries: new Map(), today: null });

/* Notification state for the vehicle-level "email active / last notified"
   columns. Returns { ready:false } (not an error) when migration v13 has
   not been applied, so every page still works and says so honestly. */
async function loadNotificationState(sb = getDb()) {
  const today = todayInZone();
  const out = { ready: true, settings: {}, recipientCount: {}, byKey: new Map(), todayDeliveries: new Map(), today };
  const [{ data: settings, error: e1 }, { data: recipients, error: e2 }, { data: alerts, error: e3 }, { data: deliveries, error: e4 }] = await Promise.all([
    sb.from('car_alert_type_settings').select('*'),
    sb.from('car_alert_recipients').select('id, alert_type, enabled'),
    sb.from('car_expiry_alerts').select('id, car_id, alert_type, expiry_date, state, last_sent_on, resolved_on, resolved_reason, first_detected_on'),
    sb.from('car_expiry_alert_deliveries').select('alert_id, status').eq('sent_on', today),
  ]);
  for (const err of [e1, e2, e3, e4]) {
    if (err) {
      if (isSchemaMissing(err)) return NOT_READY();
      const e = new Error('Could not load alert state.'); e.cause = err; throw e;
    }
  }
  for (const t of TYPES) {
    out.settings[t] = { ...DEFAULT_TYPE_SETTINGS, ...((settings || []).find(r => r.alert_type === t) || {}) };
    out.recipientCount[t] = (recipients || []).filter(r => r.enabled && r.alert_type === t).length;
  }
  for (const a of alerts || []) out.byKey.set(`${a.car_id}:${a.alert_type}:${String(a.expiry_date).slice(0, 10)}`, a);
  for (const d of deliveries || []) {
    /* Worst status wins for the day: failed > pending > sent. */
    const prev = out.todayDeliveries.get(d.alert_id);
    const rank = { failed: 3, pending: 2, sent: 1 };
    if (!prev || (rank[d.status] || 0) > (rank[prev] || 0)) out.todayDeliveries.set(d.alert_id, d.status);
  }
  return out;
}

/* Is an email actually going to go out for this alert type, right now? */
function emailActive(state, alertType) {
  if (!state.ready || !state.settings || !state.settings[alertType]) return false;
  const s = state.settings[alertType];
  return !!(s.enabled && s.auto_notify_enabled && (state.recipientCount[alertType] || 0) > 0);
}

/* deliveryState: 'disabled' | 'not_sent' | 'sent_today' | 'sent_previously' | 'failed' | null (unknown) */
function notificationFor(state, carId, rec) {
  if (!rec.hasDate) return { emailActive: false, lastNotifiedOn: null, deliveryState: null };
  if (!state.ready) return { emailActive: false, lastNotifiedOn: null, deliveryState: null };
  const row = state.byKey.get(`${carId}:${rec.alertType}:${rec.expiryDate}`);
  const active = rec.isActive && emailActive(state, rec.alertType);
  const lastNotifiedOn = row && row.last_sent_on ? String(row.last_sent_on).slice(0, 10) : null;
  let deliveryState = null;
  if (rec.isActive) {
    const todayStatus = row ? state.todayDeliveries.get(row.id) : null;
    if (!active) deliveryState = 'disabled';
    else if (todayStatus === 'failed') deliveryState = 'failed';
    else if (lastNotifiedOn === state.today) deliveryState = 'sent_today';
    else if (lastNotifiedOn) deliveryState = 'sent_previously';
    else deliveryState = 'not_sent';
  }
  return { emailActive: active, lastNotifiedOn, deliveryState };
}

/* One list row per vehicle for the Insurance / Inspection pages. */
function listRows(vehicles, kind, state, today) {
  return vehicles.map(v => {
    const e = buildVehicleExpiry(v, { today });
    const rec = e[kind];
    return {
      id: v.id, vehicleNumber: v.vehicle_number, vehicleName: v.name || null, vehicleStatus: v.status || null,
      ...rec, notification: notificationFor(state, v.id, rec),
    };
  });
}

module.exports = { loadActiveVehicles, loadNotificationState, emailActive, notificationFor, listRows, collectAlerts, summarizeFleet, todayInZone, buildVehicleExpiry };
