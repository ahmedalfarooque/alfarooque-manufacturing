'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const q = url.searchParams;
  const category = q.get('category') || '';
  const page = Math.max(1, parseInt(q.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(q.get('pageSize') || '25', 10)));

  const sb = getDb();
  let query = sb.from('acc_expenses')
    .select('*, platform_users!acc_expenses_created_by_fkey(full_name)', { count: 'exact' });
  if (category) query = query.eq('category', category);
  query = query.order('expense_date', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) { console.error('[expenses] list failed:', error.message); return json({ error: 'Could not load expenses.' }, 500); }
  return json({ expenses: data || [], total: count || 0, page, pageSize });
}

export async function POST(req) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.description) return json({ error: 'Description is required.' }, 400);
  if (!body.amount || Number(body.amount) <= 0) return json({ error: 'Amount must be positive.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('acc_expenses').insert({
    expense_date: body.expense_date || new Date().toISOString().slice(0, 10),
    description: String(body.description).trim(),
    category: body.category || 'General',
    amount: Number(body.amount),
    currency: body.currency || 'SAR',
    tax_amount: Number(body.tax_amount || 0),
    vendor_name: body.vendor_name || null,
    receipt_url: body.receipt_url || null,
    project_id: body.project_id || null,
    bank_account_id: body.bank_account_id || null,
    status: 'Pending',
    notes: body.notes || null,
    created_by: session.sub,
  }).select().single();
  if (error) { console.error('[expenses] create failed:', error.message); return json({ error: 'Could not create expense.' }, 500); }
  return json({ expense: data }, 201);
}
