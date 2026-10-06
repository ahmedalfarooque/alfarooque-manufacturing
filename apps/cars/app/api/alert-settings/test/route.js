'use strict';

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');
const { sendEmail } = require('@/lib/email');
const { createSupabaseStore, isSchemaMissing, TYPES } = require('@/lib/alertStore');
const { runTestNotification } = require('@/lib/alertEngine');
const { loadActiveVehicles } = require('@/lib/fleetData');

/* POST { alert_type } — manual "Send test notification" for one alert
   type. Admin only. Sends the real template (marked TEST) to that type's
   enabled recipients through the existing Resend helper, honouring the
   same mock/live rule as the daily job. Logged to car_alert_test_sends,
   never to the real delivery log. A 30-second per-type cooldown guards
   against accidental double sends. */

const COOLDOWN_MS = 30 * 1000;

function emailMode() {
  const v = String(process.env.ALERT_EMAIL_MODE || '').toLowerCase();
  if (v === 'live' || v === 'mock') return v;
  return process.env.VERCEL_ENV === 'production' ? 'live' : 'mock';
}

export async function POST(req) {
  const { response, session } = await requireAction(req, 'edit');
  if (response) return response;
  if (session.role !== 'admin') return json({ error: 'Only administrators can send test notifications.' }, 403);
  const body = await req.json().catch(() => ({}));
  if (!TYPES.includes(body.alert_type)) return json({ error: 'Unknown alert type.' }, 400);
  const mode = emailMode();
  try {
    const sb = getDb();
    const store = createSupabaseStore(sb);
    const last = await store.lastTestSend(body.alert_type);
    if (last && Date.now() - new Date(last.created_at).getTime() < COOLDOWN_MS) {
      return json({ error: 'A test was sent moments ago. Please wait 30 seconds before sending another.', code: 'COOLDOWN' }, 429);
    }
    const report = await runTestNotification({
      store, vehicles: await loadActiveVehicles(sb), alertType: body.alert_type, mode,
      send: m => sendEmail({ ...m, forceMock: mode !== 'live' }),
      sentBy: session.email || null,
      baseUrl: process.env.NEXT_PUBLIC_CARS_APP_URL || '',
      company: process.env.NEXT_PUBLIC_COMPANY_NAME_EN || 'AL FAROOQUE',
    });
    console.log('[alert-test] ' + JSON.stringify({ type: report.alertType, mode, recipients: report.recipients, sent: report.sent, failed: report.failed, sample: report.usedSample }));
    if (report.reason === 'no_enabled_recipients') return json({ error: 'No enabled recipients for this alert type.', code: 'NO_RECIPIENTS', report }, 400);
    return json({ ok: report.failed === 0, report }, report.failed ? 207 : 200);
  } catch (e) {
    if (e.code === 'SCHEMA_MISSING' || isSchemaMissing(e.cause || e)) return json({ error: 'Alert tables are not installed (migration apps-schema-v13 not applied).', code: 'SCHEMA_MISSING' }, 503);
    console.error('[alert-test] failed:', e.cause?.message || e.message);
    return json({ error: 'Test notification failed.' }, 500);
  }
}
