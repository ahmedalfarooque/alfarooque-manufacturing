'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = ['customer_name', 'customer_email', 'customer_address', 'invoice_date', 'due_date', 'currency', 'subtotal', 'tax_amount', 'total_amount', 'status', 'notes', 'project_id'];
const VALID_STATUSES = ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled', 'Partially Paid'];

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('acc_invoices').select('*').eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load invoice.' }, 500);
  if (!data) return json({ error: 'Invoice not found.' }, 404);
  const { data: lines } = await sb.from('acc_invoice_lines').select('*').eq('invoice_id', params.id).order('sort_order');
  return json({ invoice: data, lines: lines || [] });
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
  const { data, error } = await sb.from('acc_invoices').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[invoices] update failed:', error.message); return json({ error: 'Could not update invoice.' }, 500); }
  if (!data) return json({ error: 'Invoice not found.' }, 404);
  return json({ invoice: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('acc_invoices').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete invoice.' }, 500);
  return json({ ok: true });
}
