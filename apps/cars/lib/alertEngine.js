'use strict';

/* Daily expiry-alert job (Insurance + Periodic Vehicle Inspection).

   Pure orchestration over two injected dependencies, so the exact same
   logic runs against Supabase in the app and an in-memory store in tests:
     store  — persistence (see lib/alertStore.js for the Supabase one)
     send   — async ({ to, subject, html, text }) => { id? , mocked? }

   Behaviour:
   - An alert is ACTIVE while the vehicle has an expiry date that is 30
     days away or closer, including already-expired. Each active alert is
     emailed to every enabled recipient once per calendar day (company
     timezone), as a single digest per recipient.
   - Idempotent: before sending, the job claims a (alert, recipient, day)
     delivery row; a second run on the same day claims nothing and sends
     nothing. A failed delivery stays claimable, so a retry the same day
     only re-sends what failed.
   - An alert resolves automatically when the record changes: the date is
     renewed/changed (a new expiry date is a new alert key, so the
     notification state starts fresh), removed, or the vehicle is
     deactivated. A removed date is never emailed as a "missing date".
   - dryRun computes the plan and touches nothing (no writes, no emails). */

const { collectAlerts, todayInZone, normalizeDate, ALERT_TYPES, WITHIN_DAYS } = require('./fleetExpiry');
const { buildExpiryDigest } = require('./expiryEmail');

const alertKey = (carId, type, date) => `${carId}:${type}:${date}`;

function maskEmail(e) {
  const [u, d] = String(e).split('@');
  return (u ? u.slice(0, 1) : '') + '***@' + (d || '');
}

async function runExpiryAlertJob({ store, vehicles, send, now, mode = 'mock', dryRun = false, baseUrl = '', company = 'AL FAROOQUE' }) {
  const today = todayInZone(now);
  const report = {
    today, mode, dryRun, activeAlerts: 0, recipients: 0, emailsSent: 0, emailsFailed: 0,
    duplicatesSkipped: 0, resolved: [], reasonsNotSent: [], errors: [], plan: [],
  };

  const settings = await store.getSettings();
  const enabledTypes = new Set();
  if (settings.insurance_alerts_enabled) enabledTypes.add(ALERT_TYPES.INSURANCE);
  if (settings.inspection_alerts_enabled) enabledTypes.add(ALERT_TYPES.INSPECTION);

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

  /* ── 2. Which alerts are eligible to send ── */
  const eligible = computed.filter(a => enabledTypes.has(a.alertType));
  report.activeAlerts = eligible.length;

  if (!settings.daily_notification_enabled) report.reasonsNotSent.push('daily_notification_disabled');
  if (enabledTypes.size === 0) report.reasonsNotSent.push('all_alert_types_disabled');
  if (eligible.length === 0) report.reasonsNotSent.push('no_active_alerts');
  const recipients = (await store.listRecipients()).filter(r => r.enabled).map(r => String(r.email).toLowerCase());
  report.recipients = recipients.length;
  if (recipients.length === 0) report.reasonsNotSent.push('no_enabled_recipients');

  if (report.reasonsNotSent.length) {
    /* Still persist state for visibility (vehicle-level "alert active"),
       but only when we are really running. */
    if (!dryRun) for (const a of eligible) await store.upsertActiveAlert({ car_id: a.carId, alert_type: a.alertType, expiry_date: a.expiryDate, today });
    return report;
  }

  /* ── 3. Ensure a state row per eligible alert ── */
  const withIds = [];
  for (const a of eligible) {
    const row = dryRun ? await store.findAlert(a.carId, a.alertType, a.expiryDate) : await store.upsertActiveAlert({ car_id: a.carId, alert_type: a.alertType, expiry_date: a.expiryDate, today });
    withIds.push({ ...a, alertId: row ? row.id : null });
  }

  /* ── 4. One digest per recipient, claiming each delivery first ── */
  const sentAlertIds = new Set();
  for (const to of recipients) {
    const claimed = [];
    for (const a of withIds) {
      if (dryRun) {
        const done = a.alertId ? await store.isDelivered(a.alertId, to, today, mode) : false;
        if (done) report.duplicatesSkipped++; else claimed.push(a);
        continue;
      }
      const ok = await store.claimDelivery({ alertId: a.alertId, recipient: to, day: today, mode });
      if (ok) claimed.push(a); else report.duplicatesSkipped++;
    }
    if (claimed.length === 0) continue;

    if (dryRun) { report.plan.push({ to: maskEmail(to), items: claimed.length }); continue; }

    const digest = buildExpiryDigest(claimed, { language: settings.email_language || 'en', company, baseUrl, withinDays: WITHIN_DAYS });
    try {
      const res = await send({ to, subject: digest.subject, html: digest.html, text: digest.text });
      const status = res && res.mocked ? 'mocked' : 'sent';
      for (const a of claimed) {
        await store.finishDelivery({ alertId: a.alertId, recipient: to, day: today, status, providerId: res && res.id ? res.id : null });
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

module.exports = { runExpiryAlertJob, alertKey, maskEmail };
