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
  let query = sb.from('acc_bills').select('*', { count: 'exact' });
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`bill_number.ilike.%${search}%,vendor_name.ilike.%${search}%`);
  query = query.order('bill_date', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) { console.error('[bills] list failed:', error.message); return json({ error: 'Could not load bills.' }, 500); }
  return json({ bills: data || [], total: count || 0, page, pageSize });
}

export async function POST(req) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.vendor_name) return json({ error: 'Vendor name is required.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('acc_bills').insert({
    bill_number: body.bill_number || null,
    vendor_name: String(body.vendor_name).trim(),
    vendor_email: body.vendor_email || null,
    vendor_address: body.vendor_address || null,
    bill_date: body.bill_date || new Date().toISOString().slice(0, 10),
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
  if (error) { console.error('[bills] create failed:', error.message); return json({ error: 'Could not create bill.' }, 500); }
  return json({ bill: data }, 201);
}
