'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = ['payment_date', 'amount', 'currency', 'bank_account_id', 'reference', 'party_name', 'invoice_id', 'bill_id', 'notes'];

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('acc_payments')
    .select('*, acc_bank_accounts(name)')
    .eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load payment.' }, 500);
  if (!data) return json({ error: 'Payment not found.' }, 404);
  return json({ payment: data });
}

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  EDITABLE.forEach(f => { if (body[f] !== undefined) patch[f] = body[f]; });
  if (patch.amount !== undefined && Number(patch.amount) <= 0) return json({ error: 'Amount must be positive.' }, 400);
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('acc_payments').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[payments] update failed:', error.message); return json({ error: 'Could not update payment.' }, 500); }
  if (!data) return json({ error: 'Payment not found.' }, 404);
  return json({ payment: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('acc_payments').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete payment.' }, 500);
  return json({ ok: true });
}
