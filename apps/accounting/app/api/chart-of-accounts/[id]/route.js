'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('acc_chart_of_accounts').select('*').eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load account.' }, 500);
  if (!data) return json({ error: 'Account not found.' }, 404);
  return json({ account: data });
}

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  ['account_code', 'name', 'name_ar', 'account_type', 'category', 'parent_id', 'description', 'is_active'].forEach(f => {
    if (body[f] !== undefined) patch[f] = body[f];
  });
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('acc_chart_of_accounts').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[coa] update failed:', error.message); return json({ error: 'Could not update account.' }, 500); }
  if (!data) return json({ error: 'Account not found.' }, 404);
  return json({ account: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('acc_chart_of_accounts').delete().eq('id', params.id);
  if (error) { console.error('[coa] delete failed:', error.message); return json({ error: 'Could not delete account.' }, 500); }
  return json({ ok: true });
}
