'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = ['full_name', 'company_name', 'email', 'mobile_number', 'vat_number', 'cr_number', 'address', 'city', 'country', 'notes'];

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('customers').select('*').eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load customer.' }, 500);
  if (!data) return json({ error: 'Customer not found.' }, 404);
  return json({ customer: data });
}

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  for (const key of EDITABLE) if (key in body) patch[key] = body[key];
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);
  if ('full_name' in patch && !String(patch.full_name).trim()) return json({ error: 'Full name is required.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('customers').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[customers] update failed:', error.message); return json({ error: 'Could not update customer.' }, 500); }
  if (!data) return json({ error: 'Customer not found.' }, 404);
  return json({ customer: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;
  const sb = getDb();
  const { error } = await sb.from('customers').delete().eq('id', params.id);
  if (error) { console.error('[customers] delete failed:', error.message); return json({ error: 'Could not delete customer.' }, 500); }
  return json({ ok: true });
}
