'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const search = (url.searchParams.get('search') || '').trim();
  const type = url.searchParams.get('type') || '';

  const sb = getDb();
  let query = sb.from('acc_chart_of_accounts').select('*').order('account_code');
  if (type) query = query.eq('account_type', type);
  if (search) query = query.or(`account_code.ilike.%${search}%,name.ilike.%${search}%`);

  const { data, error } = await query;
  if (error) { console.error('[coa] list failed:', error.message); return json({ error: 'Could not load accounts.' }, 500); }
  return json({ accounts: data || [] });
}

export async function POST(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.account_code) return json({ error: 'Account code is required.' }, 400);
  if (!body.name) return json({ error: 'Account name is required.' }, 400);
  if (!body.account_type) return json({ error: 'Account type is required.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('acc_chart_of_accounts').insert({
    account_code: String(body.account_code).trim(),
    name: String(body.name).trim(),
    name_ar: body.name_ar || null,
    account_type: body.account_type,
    category: body.category || null,
    parent_id: body.parent_id || null,
    description: body.description || null,
    is_active: body.is_active !== false,
  }).select().single();
  if (error) { console.error('[coa] create failed:', error.message); return json({ error: 'Could not create account.' }, 500); }
  return json({ account: data }, 201);
}
