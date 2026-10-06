'use strict';

const { json, requireAction } = require('@/lib/http');
const { createSupabaseStore, isSchemaMissing, TYPES } = require('@/lib/alertStore');
const { describe } = require('@/lib/alertSchedule');

const SCHEMA_MSG = 'Alert settings are not available yet: the database migration (apps-schema-v13) has not been applied.';

function emailMode() {
  const v = String(process.env.ALERT_EMAIL_MODE || '').toLowerCase();
  if (v === 'live' || v === 'mock') return v;
  return process.env.VERCEL_ENV === 'production' ? 'live' : 'mock';
}

function schemaOr500(e, what) {
  if (e.code === 'SCHEMA_MISSING' || isSchemaMissing(e.cause || e)) return json({ error: SCHEMA_MSG, code: 'SCHEMA_MISSING', schedule: describe(), emailMode: emailMode() }, 503);
  console.error('[alert-settings] ' + what + ' failed:', e.cause?.message || e.message);
  return json({ error: 'Could not ' + what + '.' }, 500);
}

/* Per-type settings + recipients + last run / last test. Visible to anyone
   who can view Alerts; only administrators can change anything. */
export async function GET(req) {
  const { response, session } = await requireAction(req, 'view');
  if (response) return response;
  try {
    const store = createSupabaseStore();
    const [settings, recipients, lastRun] = await Promise.all([store.getSettings(), store.listRecipients(), store.lastRun()]);
    const types = {};
    for (const t of TYPES) {
      types[t] = { settings: settings[t], recipients: recipients.filter(r => r.alert_type === t), lastTest: await store.lastTestSend(t) };
    }
    return json({ types, lastRun, schedule: describe(), emailMode: emailMode(), canManage: session.role === 'admin' });
  } catch (e) { return schemaOr500(e, 'load alert settings'); }
}

const BOOLS = ['enabled', 'auto_notify_enabled'];

export async function PUT(req) {
  const { response, session } = await requireAction(req, 'edit');
  if (response) return response;
  if (session.role !== 'admin') return json({ error: 'Only administrators can change alert settings.' }, 403);
  const body = await req.json().catch(() => ({}));
  if (!TYPES.includes(body.alert_type)) return json({ error: 'Unknown alert type.' }, 400);
  const patch = {};
  for (const k of BOOLS) {
    if (!(k in body)) continue;
    if (typeof body[k] !== 'boolean') return json({ error: 'Invalid value for ' + k + '.' }, 400);
    patch[k] = body[k];
  }
  if ('email_language' in body) {
    if (!['en', 'ar', 'both'].includes(body.email_language)) return json({ error: 'Invalid email language.' }, 400);
    patch.email_language = body.email_language;
  }
  if (!Object.keys(patch).length) return json({ error: 'Nothing to update.' }, 400);
  try {
    const settings = await createSupabaseStore().saveSettings(body.alert_type, patch, session.email || null);
    return json({ settings });
  } catch (e) { return schemaOr500(e, 'save alert settings'); }
}
