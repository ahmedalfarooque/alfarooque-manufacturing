'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = ['expense_date', 'description', 'category', 'amount', 'currency', 'tax_amount', 'vendor_name', 'receipt_url', 'project_id', 'bank_account_id', 'status', 'notes'];
const VALID_STATUSES = ['Pending', 'Approved', 'Rejected', 'Paid'];

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('acc_expenses')
    .select('*, platform_users!acc_expenses_created_by_fkey(full_name)')
    .eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load expense.' }, 500);
  if (!data) return json({ error: 'Expense not found.' }, 404);
  return json({ expense: data });
}

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  EDITABLE.forEach(f => { if (body[f] !== undefined) patch[f] = body[f]; });
  if (patch.status && !VALID_STATUSES.includes(patch.status)) return json({ error: 'Invalid status.' }, 400);
  if (patch.amount !== undefined && Number(patch.amount) <= 0) return json({ error: 'Amount must be positive.' }, 400);
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('acc_expenses').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[expenses] update failed:', error.message); return json({ error: 'Could not update expense.' }, 500); }
  if (!data) return json({ error: 'Expense not found.' }, 404);
  return json({ expense: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('acc_expenses').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete expense.' }, 500);
  return json({ ok: true });
}
