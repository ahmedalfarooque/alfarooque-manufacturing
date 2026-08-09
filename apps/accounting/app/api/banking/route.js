'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('acc_bank_accounts').select('*').order('name');
  if (error) { console.error('[banking] list failed:', error.message); return json({ error: 'Could not load bank accounts.' }, 500); }
  return json({ accounts: data || [] });
}

export async function POST(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.name) return json({ error: 'Account name is required.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('acc_bank_accounts').insert({
    name: String(body.name).trim(),
    bank_name: body.bank_name || null,
    account_number: body.account_number || null,
    iban: body.iban || null,
    currency: body.currency || 'SAR',
    current_balance: Number(body.current_balance || 0),
    is_active: body.is_active !== false,
  }).select().single();
  if (error) { console.error('[banking] create failed:', error.message); return json({ error: 'Could not create bank account.' }, 500); }
  return json({ account: data }, 201);
}
