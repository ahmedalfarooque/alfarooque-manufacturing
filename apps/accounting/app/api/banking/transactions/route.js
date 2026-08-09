'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const q = url.searchParams;
  const accountId = q.get('account_id') || '';
  const page = Math.max(1, parseInt(q.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(q.get('pageSize') || '25', 10)));

  const sb = getDb();
  let query = sb.from('acc_bank_transactions')
    .select('*, acc_bank_accounts(name)', { count: 'exact' });
  if (accountId) query = query.eq('bank_account_id', accountId);
  query = query.order('transaction_date', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) { console.error('[banking/transactions] list failed:', error.message); return json({ error: 'Could not load transactions.' }, 500); }
  return json({ transactions: data || [], total: count || 0, page, pageSize });
}

export async function POST(req) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.bank_account_id) return json({ error: 'Bank account is required.' }, 400);
  if (!body.transaction_type) return json({ error: 'Transaction type is required.' }, 400);
  if (!body.amount || Number(body.amount) <= 0) return json({ error: 'Amount must be positive.' }, 400);

  const VALID_TYPES = ['credit', 'debit'];
  if (!VALID_TYPES.includes(body.transaction_type)) return json({ error: 'Invalid transaction type.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('acc_bank_transactions').insert({
    bank_account_id: body.bank_account_id,
    transaction_date: body.transaction_date || new Date().toISOString().slice(0, 10),
    transaction_type: body.transaction_type,
    amount: Number(body.amount),
    description: body.description || null,
    reference: body.reference || null,
    payment_id: body.payment_id || null,
    created_by: session.sub,
  }).select().single();
  if (error) { console.error('[banking/transactions] create failed:', error.message); return json({ error: 'Could not create transaction.' }, 500); }
  return json({ transaction: data }, 201);
}
