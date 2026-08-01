'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('crm_settings').select('*').maybeSingle();
  if (error) return json({ error: 'Could not load settings.' }, 500);
  return json({ settings: data || {} });
}

export async function PATCH(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const ALLOWED = ['company_name', 'default_currency', 'deal_stages', 'activity_types', 'contact_sources', 'win_probability_threshold'];
  const patch = {};
  ALLOWED.forEach(f => { if (body[f] !== undefined) patch[f] = body[f]; });
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const sb = getDb();
  const { data: existing } = await sb.from('crm_settings').select('id').maybeSingle();
  let result;
  if (existing) {
    result = await sb.from('crm_settings').update(patch).eq('id', existing.id).select().single();
  } else {
    result = await sb.from('crm_settings').insert(patch).select().single();
  }
  if (result.error) return json({ error: 'Could not update settings.' }, 500);
  return json({ settings: result.data });
}
