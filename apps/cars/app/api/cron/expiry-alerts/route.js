'use strict';

const crypto = require('crypto');
const { getDb } = require('@/lib/db');
const { json } = require('@/lib/http');
const { readSession } = require('@/lib/auth');
const { sendEmail, emailConfig } = require('@/lib/email');
const { createSupabaseStore, isSchemaMissing } = require('@/lib/alertStore');
const { runExpiryAlertJob } = require('@/lib/alertEngine');
const { loadActiveVehicles } = require('@/lib/fleetData');
const { todayInZone } = require('@/lib/fleetExpiry');

/* Daily expiry-alert job.
   - GET  : Vercel Cron (vercel.json "crons"). Vercel sends
            `Authorization: Bearer $CRON_SECRET` — the same mechanism as
            apps/quotation/app/api/cron/expire. There is no cookie path on
            GET, so a browser visit can never trigger a send.
   - POST : manual trigger for an admin session. Defaults to dryRun
            (computes the plan, writes nothing, sends nothing); pass
            { "dryRun": false } to really run.

   Email: always the real Resend helper (lib/email.js). If RESEND_API_KEY
   or EMAIL_FROM is missing, a real run is recorded as failed with an
   actionable message and nothing is reported as sent. */

function secretMatches(header) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(String(header)), b = Buffer.from('Bearer ' + secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function run({ dryRun, trigger }) {
  const startedAt = Date.now();
  let store = null, runId = null;
  try {
    const sb = getDb();
    store = createSupabaseStore(sb);
    const vehicles = await loadActiveVehicles(sb);
    /* Real runs are logged (car_alert_job_runs) so the settings page can
       show the last run honestly; dry runs are not. */
    if (!dryRun) runId = await store.startRun({ trigger, today: todayInZone() });
    const cfg = emailConfig();
    if (!cfg.configured && !dryRun) {
      const msg = 'Email is not configured (missing ' + cfg.missing.join(', ') + '); no alert emails can be sent.';
      console.error('[expiry-alerts] ' + trigger + ' ' + msg);
      if (runId) await store.finishRun(runId, {}, msg).catch(() => {});
      return json({ ok: false, error: msg, code: 'NO_EMAIL_CONFIG', missing: cfg.missing }, 503);
    }
    let report;
    try {
      report = await runExpiryAlertJob({
        store, vehicles,
        send: sendEmail,
        dryRun,
        baseUrl: process.env.NEXT_PUBLIC_CARS_APP_URL || '',
        company: process.env.NEXT_PUBLIC_COMPANY_NAME_EN || 'AL FAROOQUE',
      });
    } catch (jobErr) {
      if (runId) await store.finishRun(runId, {}, jobErr.message).catch(() => {});
      throw jobErr;
    }
    if (runId) await store.finishRun(runId, report, null);
    /* Counts only — no recipient addresses, no credentials. */
    console.log('[expiry-alerts] ' + trigger + ' ' + JSON.stringify({
      dryRun, today: report.today, emailConfigured: cfg.configured, active: report.activeAlerts, recipients: report.recipients,
      sent: report.emailsSent, failed: report.emailsFailed, duplicates: report.duplicatesSkipped,
      resolved: report.resolved.length, ms: Date.now() - startedAt,
    }));
    return json({ ok: report.emailsFailed === 0, report }, report.emailsFailed ? 207 : 200);
  } catch (e) {
    if (e.code === 'SCHEMA_MISSING' || isSchemaMissing(e.cause || e)) {
      console.error('[expiry-alerts] schema missing — apply apps-schema-v13-cars-expiry-alerts.sql');
      return json({ ok: false, error: 'Alert tables are not installed (migration apps-schema-v13 not applied).', code: 'SCHEMA_MISSING' }, 503);
    }
    console.error('[expiry-alerts] run failed:', e.cause?.message || e.message);
    return json({ ok: false, error: 'Alert job failed.' }, 500);
  }
}

export async function GET(req) {
  if (!secretMatches(req.headers.get('authorization'))) return json({ error: 'Not authorized.' }, 401);
  return run({ dryRun: false, trigger: 'cron' });
}

export async function POST(req) {
  const session = readSession(req);
  if (!session) return json({ error: 'Not authenticated.' }, 401);
  if (session.role !== 'admin') return json({ error: 'Only administrators can run the alert job.' }, 403);
  const body = await req.json().catch(() => ({}));
  return run({ dryRun: body.dryRun !== false, trigger: 'manual' });
}
