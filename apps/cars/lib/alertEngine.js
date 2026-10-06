'use strict';

/* Daily expiry-alert job (Insurance + Periodic Vehicle Inspection) and
   the manual "Send test notification" action.

   Pure orchestration over two injected dependencies, so the exact same
   logic runs against Supabase in the app and an in-memory store in tests:
     store  — persistence (see lib/alertStore.js for the Supabase one)
     send   — async ({ to, subject, html, text }) => { id } (rejects on failure)

   Configuration is PER ALERT TYPE (insurance / inspection): each type has
   its own enabled / auto-notify / language settings and its own recipient
   list. A recipient subscribed to both types still gets ONE digest per
   day containing both.

   Behaviour:
   - An alert is ACTIVE while the vehicle has an expiry date that is 30
     days away or closer, including already-expired. Each active alert of
     an enabled type is emailed once per calendar day (company timezone)
     to every enabled recipient of that type.
   - Idempotent: before sending, the job claims a (alert, recipient, day)
     delivery row; a second run on the same day claims nothing and sends
     nothing. A failed delivery stays claimable, so a retry the same day
     only re-sends what failed.
   - An alert resolves automatically when the record changes: the date is
     renewed/changed (a new expiry date is a new alert key, so the
     notification state starts fresh), removed, or the vehicle is
     deactivated. A removed date is never emailed as a "missing date".
   - dryRun computes the plan and touches nothing (no writes, no emails).
   - Test sends go through runTestNotification(): same template, same
     recipients, clearly marked TEST, logged separately, never touching
     the real delivery log.
   - There is no mock mode: `send` must be the real provider call and must
     reject when the provider did not accept the message. */

const { collectAlerts, todayInZone, normalizeDate, ALERT_TYPES, WITHIN_DAYS } = require('./fleetExpiry');
const { buildExpiryDigest } = require('./expiryEmail');

const TYPES = [ALERT_TYPES.INSURANCE, ALERT_TYPES.INSPECTION];
const alertKey = (carId, type, date) => `${carId}:${type}:${date}`;

function maskEmail(e) {
  const [u, d] = String(e).split('@');
  return (u ? u.slice(0, 1) : '') + '***@' + (d || '');
}

/* { insurance: {enabled, auto_notify_enabled, email_language}, inspection: {...} } */
function normalizeSettings(settings) {
  const out = {};
  for (const t of TYPES) {
    const s = (settings && settings[t]) || {};
    out[t] = { enabled: s.enabled !== false, auto_notify_enabled: s.auto_notify_enabled !== false, email_language: s.email_language || 'en' };
  }
  return out;
}

/* Map email -> Set(alert types) for enabled recipients of the given types. */
function recipientMap(recipients, types) {
  const map = new Map();
  for (const r of recipients || []) {
    if (!r.enabled || !types.has(r.alert_type)) continue;
    const email = String(r.email).toLowerCase();
    if (!map.has(email)) map.set(email, new Set());
    map.get(email).add(r.alert_type);
  }
  return map;
}

/* One digest may mix types with different languages → bilingual. */
function languageFor(settings, types) {
  const langs = new Set([...types].map(t => settings[t].email_language));
  if (langs.size === 1) return [...langs][0];
  return 'both';
}

async function runExpiryAlertJob({ store, vehicles, send, now, dryRun = false, baseUrl = '', company = 'AL FAROOQUE' }) {
  const today = todayInZone(now);
  const report = {
    today, dryRun, activeAlerts: 0, recipients: 0, emailsSent: 0, emailsFailed: 0,
    duplicatesSkipped: 0, resolved: [], reasonsNotSent: [], errors: [], plan: [], byType: {},
  };

  const settings = normalizeSettings(await store.getSettings());
  const trackedTypes = new Set(TYPES.filter(t => settings[t].enabled));
  const mailTypes = new Set(TYPES.filter(t => settings[t].enabled && settings[t].auto_notify_enabled));

  /* ── 1. Reconcile stored alert state against the vehicle records ── */
  const activeVehicles = vehicles || [];
  const byCar = new Map(activeVehicles.map(v => [v.id, v]));
  const computed = collectAlerts(activeVehicles, { today });
  const computedKeys = new Set(computed.map(a => a.key));

  const stored = await store.listActiveAlertStates();
  for (const row of stored) {
    const key = alertKey(row.car_id, row.alert_type, normalizeDate(row.expiry_date));
    if (computedKeys.has(key)) continue;
    const car = byCar.get(row.car_id);
    let reason;
    if (!car) reason = 'vehicle_inactive';
    else {
      const field = row.alert_type === ALERT_TYPES.INSURANCE ? 'insurance_expiry' : 'periodic_inspection_expiry';
      reason = normalizeDate(car[field]) ? 'renewed' : 'date_removed';
    }
    report.resolved.push({ carId: row.car_id, alertType: row.alert_type, expiryDate: normalizeDate(row.expiry_date), reason });
    if (!dryRun) await store.resolveAlert(row.id, today, reason);
  }

  /* ── 2. Which alerts are eligible ── */
  const tracked = computed.filter(a => trackedTypes.has(a.alertType));
  const eligible = tracked.filter(a => mailTypes.has(a.alertType));
  report.activeAlerts = tracked.length;
  for (const t of TYPES) report.byType[t] = { active: computed.filter(a => a.alertType === t).length, enabled: settings[t].enabled, autoNotify: settings[t].auto_notify_enabled, recipients: 0 };

  const recipients = recipientMap(await store.listRecipients(), mailTypes);
  for (const [, types] of recipients) for (const t of types) report.byType[t].recipients++;
  report.recipients = recipients.size;

  if (trackedTypes.size === 0) report.reasonsNotSent.push('all_alert_types_disabled');
  else if (mailTypes.size === 0) report.reasonsNotSent.push('auto_notify_disabled');
  if (eligible.length === 0) report.reasonsNotSent.push('no_active_alerts');
  if (recipients.size === 0) report.reasonsNotSent.push('no_enabled_recipients');

  if (report.reasonsNotSent.length) {
    /* Still persist state for visibility (vehicle-level "alert active"),
       but only when we are really running. */
    if (!dryRun) for (const a of tracked) await store.upsertActiveAlert({ car_id: a.carId, alert_type: a.alertType, expiry_date: a.expiryDate, today });
    return report;
  }

  /* ── 3. Ensure a state row per tracked alert ── */
  const withIds = [];
  for (const a of tracked) {
    const row = dryRun ? await store.findAlert(a.carId, a.alertType, a.expiryDate) : await store.upsertActiveAlert({ car_id: a.carId, alert_type: a.alertType, expiry_date: a.expiryDate, today });
    withIds.push({ ...a, alertId: row ? row.id : null });
  }

  /* ── 4. One digest per recipient, claiming each delivery first ── */
  const sentAlertIds = new Set();
  for (const [to, types] of recipients) {
    const mine = withIds.filter(a => types.has(a.alertType) && mailTypes.has(a.alertType));
    const claimed = [];
    for (const a of mine) {
      if (dryRun) {
        const done = a.alertId ? await store.isDelivered(a.alertId, to, today) : false;
        if (done) report.duplicatesSkipped++; else claimed.push(a);
        continue;
      }
      const ok = await store.claimDelivery({ alertId: a.alertId, recipient: to, day: today });
      if (ok) claimed.push(a); else report.duplicatesSkipped++;
    }
    if (claimed.length === 0) continue;

    if (dryRun) { report.plan.push({ to: maskEmail(to), items: claimed.length }); continue; }

    const language = languageFor(settings, new Set(claimed.map(a => a.alertType)));
    const digest = buildExpiryDigest(claimed, { language, company, baseUrl, withinDays: WITHIN_DAYS });
    try {
      /* `send` resolves only when the provider accepted the message. */
      const res = await send({ to, subject: digest.subject, html: digest.html, text: digest.text });
      for (const a of claimed) {
        await store.finishDelivery({ alertId: a.alertId, recipient: to, day: today, status: 'sent', providerId: res && res.id ? res.id : null });
        sentAlertIds.add(a.alertId);
      }
      report.emailsSent++;
    } catch (err) {
      /* Never log credentials or the provider body — only a safe message. */
      const msg = String(err && err.message ? err.message : err).slice(0, 200);
      for (const a of claimed) await store.finishDelivery({ alertId: a.alertId, recipient: to, day: today, status: 'failed', error: msg });
      report.emailsFailed++;
      report.errors.push({ to: maskEmail(to), message: msg });
    }
  }
  for (const id of sentAlertIds) await store.markSent(id, today);
  return report;
}

/* Sample item used ONLY when the fleet has no real active alert of the
   requested type. Clearly synthetic — never written anywhere. */
function sampleItem(alertType, today) {
  const d = new Date(today + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 12);
  return {
    carId: null, vehicleNumber: 'TEST-0000', vehicleName: 'Sample vehicle (test only)',
    alertType, expiryDate: d.toISOString().slice(0, 10), daysRemaining: 12, status: 'expiring_soon', severity: 'urgent', isSample: true,
  };
}

/* Manual test notification for ONE alert type: real template, real
   recipients of that type, marked TEST, logged to the test-send log.
   Never touches alert state or the real delivery log. */
async function runTestNotification({ store, vehicles, send, alertType, now, sentBy = null, baseUrl = '', company = 'AL FAROOQUE' }) {
  if (!TYPES.includes(alertType)) throw Object.assign(new Error('Unknown alert type.'), { code: 'BAD_TYPE' });
  const today = todayInZone(now);
  const settings = normalizeSettings(await store.getSettings());
  const recipients = [...recipientMap(await store.listRecipients(), new Set([alertType])).keys()];
  const report = { alertType, today, recipients: recipients.length, sent: 0, failed: 0, usedSample: false, items: 0, results: [] };
  if (recipients.length === 0) { report.reason = 'no_enabled_recipients'; return report; }

  let items = collectAlerts(vehicles || [], { today }).filter(a => a.alertType === alertType);
  if (items.length === 0) { items = [sampleItem(alertType, today)]; report.usedSample = true; }
  report.items = items.length;
  const digest = buildExpiryDigest(items, { language: settings[alertType].email_language, company, baseUrl, withinDays: WITHIN_DAYS, isTest: true });

  for (const to of recipients) {
    try {
      const res = await send({ to, subject: digest.subject, html: digest.html, text: digest.text });
      await store.recordTestSend({ alertType, recipient: to, sentBy, status: 'sent', providerId: res && res.id ? res.id : null });
      report.sent++;
      report.results.push({ to: maskEmail(to), status: 'sent', providerId: res && res.id ? res.id : null });
    } catch (err) {
      const msg = String(err && err.message ? err.message : err).slice(0, 200);
      await store.recordTestSend({ alertType, recipient: to, sentBy, status: 'failed', error: msg });
      report.failed++;
      report.results.push({ to: maskEmail(to), status: 'failed', error: msg });
    }
  }
  return report;
}

module.exports = { runExpiryAlertJob, runTestNotification, normalizeSettings, alertKey, maskEmail, TYPES };
