'use strict';

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');
const { isSchemaMissing, TYPES } = require('@/lib/alertStore');
const { normalizeEmail, isValidEmail, MAX_RECIPIENTS } = require('@/lib/alertSettings');

const SCHEMA_MSG = 'Alert recipients are not available yet: the database migration (apps-schema-v13) has not been applied.';

/* Authorization: the caller needs edit rights on Alerts AND must be an
   administrator — recipients decide where fleet data is emailed, so this
   is deliberately stricter than ordinary data editing. */
async function guard(req) {
  const { response, session } = await requireAction(req, 'edit');
  if (response) return { response };
  if (session.role !== 'admin') return { response: json({ error: 'Only administrators can manage alert recipients.' }, 403) };
  return { session };
}

function fail(error, what) {
  if (isSchemaMissing(error)) return json({ error: SCHEMA_MSG, code: 'SCHEMA_MISSING' }, 503);
  console.error('[alert-recipients] ' + what + ' failed:', error && error.message);
  return json({ error: 'Could not ' + what + '.' }, 500);
}

/* POST { email, alert_type, name? } — one recipient row per alert type. */
export async function POST(req) {
  const { response, session } = await guard(req);
  if (response) return response;
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!TYPES.includes(body.alert_type)) return json({ error: 'Unknown alert type.', code: 'BAD_TYPE' }, 400);
  if (!isValidEmail(email)) return json({ error: 'Enter a valid email address.', code: 'INVALID_EMAIL' }, 400);
  const sb = getDb();
  const { count, error: cErr } = await sb.from('car_alert_recipients').select('id', { count: 'exact', head: true }).eq('alert_type', body.alert_type);
  if (cErr) return fail(cErr, 'add recipient');
  if ((count || 0) >= MAX_RECIPIENTS) return json({ error: 'Recipient limit reached (' + MAX_RECIPIENTS + ').', code: 'LIMIT' }, 400);
  const name = String(body.name == null ? '' : body.name).trim().slice(0, 120) || null;
  const { data, error } = await sb.from('car_alert_recipients').insert({ email, name, alert_type: body.alert_type, created_by: session.email || null }).select().single();
  if (error) {
    if (error.code === '23505') return json({ error: 'This email address is already on the list for this alert type.', code: 'DUPLICATE' }, 409);
    return fail(error, 'add recipient');
  }
  return json({ recipient: data }, 201);
}

/* PATCH { id, enabled? , email?, name? } — edit a recipient in place. The
   alert type is never changed here; duplicates within the same type are
   rejected by the unique index. */
export async function PATCH(req) {
  const { response } = await guard(req);
  if (response) return response;
  const body = await req.json().catch(() => ({}));
  if (!body.id) return json({ error: 'Recipient id is required.' }, 400);
  const patch = {};
  if ('enabled' in body) {
    if (typeof body.enabled !== 'boolean') return json({ error: 'Invalid enabled flag.' }, 400);
    patch.enabled = body.enabled;
  }
  if ('email' in body) {
    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) return json({ error: 'Enter a valid email address.', code: 'INVALID_EMAIL' }, 400);
    patch.email = email;
  }
  if ('name' in body) patch.name = String(body.name == null ? '' : body.name).trim().slice(0, 120) || null;
  if (!Object.keys(patch).length) return json({ error: 'Nothing to update.' }, 400);
  const { data, error } = await getDb().from('car_alert_recipients').update(patch).eq('id', body.id).select().maybeSingle();
  if (error) {
    if (error.code === '23505') return json({ error: 'This email address is already on the list for this alert type.', code: 'DUPLICATE' }, 409);
    return fail(error, 'update recipient');
  }
  if (!data) return json({ error: 'Recipient not found.' }, 404);
  return json({ recipient: data });
}

export async function DELETE(req) {
  const { response } = await guard(req);
  if (response) return response;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return json({ error: 'Recipient id is required.' }, 400);
  const { data, error } = await getDb().from('car_alert_recipients').delete().eq('id', id).select('id');
  if (error) return fail(error, 'remove recipient');
  if (!data || !data.length) return json({ error: 'Recipient not found.' }, 404);
  return json({ ok: true });
}
