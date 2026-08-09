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
  let query = sb.from('acc_journal_entries')
    .select('*, platform_users!acc_journal_entries_created_by_fkey(full_name, email)', { count: 'exact' });
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`journal_number.ilike.%${search}%,description.ilike.%${search}%`);
  query = query.order('entry_date', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) { console.error('[journal-entries] list failed:', error.message); return json({ error: 'Could not load journal entries.' }, 500); }
  return json({ entries: data || [], total: count || 0, page, pageSize });
}

export async function POST(req) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.entry_date) return json({ error: 'Entry date is required.' }, 400);
  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length < 2) return json({ error: 'At least two journal lines are required.' }, 400);

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.001) return json({ error: `Debits (${totalDebit}) must equal credits (${totalCredit}).` }, 400);

  const sb = getDb();
  const { data: entry, error } = await sb.from('acc_journal_entries').insert({
    entry_date: body.entry_date,
    description: body.description || null,
    reference: body.reference || null,
    currency: body.currency || 'SAR',
    total_debit: totalDebit,
    total_credit: totalCredit,
    status: 'Draft',
    created_by: session.sub,
  }).select().single();
  if (error) { console.error('[journal-entries] create failed:', error.message); return json({ error: 'Could not create journal entry.' }, 500); }

  const lineRows = lines.map(l => ({
    entry_id: entry.id,
    account_id: l.account_id,
    description: l.description || null,
    debit: Number(l.debit || 0),
    credit: Number(l.credit || 0),
  }));
  await sb.from('acc_journal_lines').insert(lineRows).catch(err => console.error('[journal-entries] lines insert failed:', err.message));

  return json({ entry }, 201);
}
