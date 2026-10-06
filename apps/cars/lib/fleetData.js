'use strict';

/* Server-side loaders shared by the Insurance / Inspection / Alerts / Stats
   / vehicle-detail routes, so every page reads the same vehicle set and
   the same notification state. */

const { getDb } = require('./db');
const { isSchemaMissing } = require('./alertStore');
const { buildVehicleExpiry, collectAlerts, summarizeFleet, todayInZone } = require('./fleetExpiry');

async function loadActiveVehicles(sb = getDb()) {
  const { data, error } = await sb.from('cars').select('*').eq('is_active', true).order('vehicle_number', { ascending: true });
  if (error) { const e = new Error('Could not load vehicles.'); e.cause = error; throw e; }
  return data || [];
}

/* Notification state for the vehicle-level "email active / last notified"
   columns. Returns { ready:false } (not an error) when migration v13 has
   not been applied, so every page still works and says so honestly. */
async function loadNotificationState(sb = getDb()) {
  const out = { ready: true, settings: null, recipientCount: 0, byKey: new Map() };
  const [{ data: settings, error: e1 }, { data: recipients, error: e2 }, { data: alerts, error: e3 }] = await Promise.all([
    sb.from('car_alert_settings').select('*').eq('id', true).maybeSingle(),
    sb.from('car_alert_recipients').select('id, enabled'),
    sb.from('car_expiry_alerts').select('car_id, alert_type, expiry_date, state, last_sent_on, resolved_on, resolved_reason, first_detected_on'),
  ]);
  for (const err of [e1, e2, e3]) {
    if (err) {
      if (isSchemaMissing(err)) return { ready: false, settings: null, recipientCount: 0, byKey: new Map() };
      const e = new Error('Could not load alert state.'); e.cause = err; throw e;
    }
  }
  out.settings = settings || { insurance_alerts_enabled: true, inspection_alerts_enabled: true, daily_notification_enabled: true, email_language: 'en' };
  out.recipientCount = (recipients || []).filter(r => r.enabled).length;
  for (const a of alerts || []) out.byKey.set(`${a.car_id}:${a.alert_type}:${String(a.expiry_date).slice(0, 10)}`, a);
  return out;
}

/* Is an email actually going to go out for this alert type, right now? */
function emailActive(state, alertType) {
  if (!state.ready || !state.settings) return false;
  const typeOn = alertType === 'insurance' ? state.settings.insurance_alerts_enabled : state.settings.inspection_alerts_enabled;
  return !!(state.settings.daily_notification_enabled && typeOn && state.recipientCount > 0);
}

function notificationFor(state, carId, rec) {
  if (!rec.hasDate) return { emailActive: false, lastNotifiedOn: null };
  const row = state.byKey.get(`${carId}:${rec.alertType}:${rec.expiryDate}`);
  return { emailActive: rec.isActive && emailActive(state, rec.alertType), lastNotifiedOn: row && row.last_sent_on ? String(row.last_sent_on).slice(0, 10) : null };
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
