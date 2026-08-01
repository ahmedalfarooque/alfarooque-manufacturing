'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = ['vendor_name', 'vendor_email', 'vendor_address', 'bill_date', 'due_date', 'currency', 'subtotal', 'tax_amount', 'total_amount', 'status', 'notes', 'project_id'];
const VALID_STATUSES = ['Draft', 'Unpaid', 'Paid', 'Overdue', 'Cancelled', 'Partially Paid'];

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('acc_bills').select('*').eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load bill.' }, 500);
  if (!data) return json({ error: 'Bill not found.' }, 404);
  const { data: lines } = await sb.from('acc_bill_lines').select('*').eq('bill_id', params.id).order('sort_order');
  return json({ bill: data, lines: lines || [] });
}

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  EDITABLE.forEach(f => { if (body[f] !== undefined) patch[f] = body[f]; });
  if (patch.status && !VALID_STATUSES.includes(patch.status)) return json({ error: 'Invalid status.' }, 400);
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('acc_bills').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[bills] update failed:', error.message); return json({ error: 'Could not update bill.' }, 500); }
  if (!data) return json({ error: 'Bill not found.' }, 404);
  return json({ bill: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('acc_bills').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete bill.' }, 500);
  return json({ ok: true });
}
