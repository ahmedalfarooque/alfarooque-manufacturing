'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const q = url.searchParams;
  const type = q.get('type') || '';
  const page = Math.max(1, parseInt(q.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(q.get('pageSize') || '25', 10)));

  const sb = getDb();
  let query = sb.from('acc_payments').select('*, acc_bank_accounts(name)', { count: 'exact' });
  if (type) query = query.eq('payment_type', type);
  query = query.order('payment_date', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) { console.error('[payments] list failed:', error.message); return json({ error: 'Could not load payments.' }, 500); }
  return json({ payments: data || [], total: count || 0, page, pageSize });
}

export async function POST(req) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.payment_type) return json({ error: 'Payment type is required.' }, 400);
  if (!body.amount || Number(body.amount) <= 0) return json({ error: 'Amount must be positive.' }, 400);
  if (!body.bank_account_id) return json({ error: 'Bank account is required.' }, 400);

  const VALID_TYPES = ['receipt', 'payment'];
  if (!VALID_TYPES.includes(body.payment_type)) return json({ error: 'Invalid payment type.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('acc_payments').insert({
    payment_type: body.payment_type,
    payment_date: body.payment_date || new Date().toISOString().slice(0, 10),
    amount: Number(body.amount),
    currency: body.currency || 'SAR',
    bank_account_id: body.bank_account_id,
    reference: body.reference || null,
    party_name: body.party_name || null,
    invoice_id: body.invoice_id || null,
    bill_id: body.bill_id || null,
    notes: body.notes || null,
    created_by: session.sub,
  }).select().single();
  if (error) { console.error('[payments] create failed:', error.message); return json({ error: 'Could not create payment.' }, 500); }
  return json({ payment: data }, 201);
}
