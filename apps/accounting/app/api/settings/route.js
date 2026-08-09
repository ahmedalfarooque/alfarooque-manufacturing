'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('acc_settings').select('*').maybeSingle();
  if (error) { console.error('[settings] load failed:', error.message); return json({ error: 'Could not load settings.' }, 500); }
  return json({ settings: data || {} });
}

export async function PATCH(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const ALLOWED = ['company_name', 'company_name_ar', 'vat_number', 'cr_number', 'address', 'address_ar', 'phone', 'email', 'default_currency', 'fiscal_year_start', 'vat_rate', 'invoice_prefix', 'bill_prefix', 'journal_prefix'];
  const patch = {};
  ALLOWED.forEach(f => { if (body[f] !== undefined) patch[f] = body[f]; });
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const sb = getDb();
  const { data: existing } = await sb.from('acc_settings').select('id').maybeSingle();
  let result;
  if (existing) {
    result = await sb.from('acc_settings').update(patch).eq('id', existing.id).select().single();
  } else {
    result = await sb.from('acc_settings').insert(patch).select().single();
  }
  if (result.error) { console.error('[settings] update failed:', result.error.message); return json({ error: 'Could not update settings.' }, 500); }
  return json({ settings: result.data });
}
