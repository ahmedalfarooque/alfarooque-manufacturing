'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const q = url.searchParams;
  const search = (q.get('search') || '').trim();
  const status = q.get('status') || '';
  const page = Math.max(1, parseInt(q.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(q.get('pageSize') || '25', 10)));

  const sb = getDb();
  let query = sb.from('acc_invoices').select('*', { count: 'exact' });
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`invoice_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
  query = query.order('invoice_date', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) { console.error('[invoices] list failed:', error.message); return json({ error: 'Could not load invoices.' }, 500); }
  return json({ invoices: data || [], total: count || 0, page, pageSize });
}

export async function POST(req) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.customer_name) return json({ error: 'Customer name is required.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('acc_invoices').insert({
    invoice_number: body.invoice_number || null,
    customer_name: String(body.customer_name).trim(),
    customer_email: body.customer_email || null,
    customer_address: body.customer_address || null,
    invoice_date: body.invoice_date || new Date().toISOString().slice(0, 10),
    due_date: body.due_date || null,
    currency: body.currency || 'SAR',
    subtotal: Number(body.subtotal || 0),
    tax_amount: Number(body.tax_amount || 0),
    total_amount: Number(body.total_amount || 0),
    status: 'Draft',
    notes: body.notes || null,
    project_id: body.project_id || null,
    created_by: session.sub,
  }).select().single();
  if (error) { console.error('[invoices] create failed:', error.message); return json({ error: 'Could not create invoice.' }, 500); }
  return json({ invoice: data }, 201);
}
