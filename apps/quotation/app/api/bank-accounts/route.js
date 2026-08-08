'use strict';

/* Company bank accounts (used in contract generation).
   GET  ?activeOnly=1 → list (any authenticated user)
   POST { bank_name, account_name, ... } → create (write permission). */

const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { getDb } = require('@/lib/db');
const repo = require('@/lib/contracts/repo');

export async function GET(req) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const url = new URL(req.url);
  try {
    const rows = await repo.listBankAccounts({ activeOnly: url.searchParams.get('activeOnly') === '1' });
    return json({ rows });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const body = await req.json().catch(() => ({}));
  if (!body.bank_name || !body.account_name) {
    return json({ error: 'bank_name and account_name are required' }, 400);
  }
  try {
    const row = await repo.createBankAccount({
      bank_name: body.bank_name, bank_name_ar: body.bank_name_ar || null,
      account_name: body.account_name, account_number: body.account_number || null,
      iban: body.iban || null, swift: body.swift || null, branch: body.branch || null,
      currency: body.currency || 'SAR', is_active: body.is_active !== false,
      sort_order: body.sort_order || 0,
    }, session.sub);
    await audit(getDb(), 'qt_bank_accounts', row.id, 'create', null, { bank_name: row.bank_name }, session.sub);
    return json(row, 201);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
