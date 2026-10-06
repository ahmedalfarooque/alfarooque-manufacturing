'use strict';

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');
const { createSupabaseStore, isSchemaMissing } = require('@/lib/alertStore');

const SCHEMA_MSG = 'Alert settings are not available yet: the database migration (apps-schema-v13) has not been applied.';

function schemaOr500(e, what) {
  if (e.code === 'SCHEMA_MISSING' || isSchemaMissing(e.cause || e)) return json({ error: SCHEMA_MSG, code: 'SCHEMA_MISSING' }, 503);
  console.error('[alert-settings] ' + what + ' failed:', e.cause?.message || e.message);
  return json({ error: 'Could not ' + what + '.' }, 500);
}

/* Settings + recipient list. Visible to anyone who can view Alerts; only
   administrators can change them (PUT here, and ./recipients). */
export async function GET(req) {
  const { response, session } = await requireAction(req, 'view');
  if (response) return response;
  try {
    const store = createSupabaseStore();
    const [settings, recipients] = await Promise.all([store.getSettings(), store.listRecipients()]);
    return json({ settings, recipients, canManage: session.role === 'admin' });
  } catch (e) { return schemaOr500(e, 'load alert settings'); }
}

const BOOLS = ['insurance_alerts_enabled', 'inspection_alerts_enabled', 'daily_notification_enabled'];

export async function PUT(req) {
  const { response, session } = await requireAction(req, 'edit');
  if (response) return response;
  if (session.role !== 'admin') return json({ error: 'Only administrators can change alert settings.' }, 403);
  const body = await req.json().catch(() => ({}));
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
    const { data, error } = await getDb().from('car_alert_settings')
      .upsert({ id: true, ...patch, updated_by: session.email || null, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select().single();
    if (error) throw Object.assign(new Error('save'), { cause: error });
    return json({ settings: data });
  } catch (e) { return schemaOr500(e, 'save alert settings'); }
}
