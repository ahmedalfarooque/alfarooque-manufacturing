'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data: entry, error } = await sb.from('acc_journal_entries')
    .select('*, platform_users!acc_journal_entries_created_by_fkey(full_name, email)')
    .eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load journal entry.' }, 500);
  if (!entry) return json({ error: 'Journal entry not found.' }, 404);

  const { data: lines } = await sb.from('acc_journal_lines')
    .select('*, acc_chart_of_accounts(account_code, name)')
    .eq('entry_id', params.id).order('id');

  return json({ entry, lines: lines || [] });
}

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data: existing } = await sb.from('acc_journal_entries').select('status').eq('id', params.id).maybeSingle();
  if (!existing) return json({ error: 'Journal entry not found.' }, 404);

  const body = await req.json().catch(() => ({}));

  if (body.action === 'post') {
    if (existing.status !== 'Draft') return json({ error: 'Only draft entries can be posted.' }, 400);
    const { data, error } = await sb.from('acc_journal_entries').update({ status: 'Posted' }).eq('id', params.id).select().single();
    if (error) return json({ error: 'Could not post entry.' }, 500);
    return json({ entry: data });
  }

  if (body.action === 'void') {
    if (existing.status === 'Voided') return json({ error: 'Entry is already voided.' }, 400);
    const { data, error } = await sb.from('acc_journal_entries').update({ status: 'Voided' }).eq('id', params.id).select().single();
    if (error) return json({ error: 'Could not void entry.' }, 500);
    return json({ entry: data });
  }

  if (existing.status !== 'Draft') return json({ error: 'Only draft entries can be edited.' }, 400);
  const patch = {};
  ['entry_date', 'description', 'reference', 'currency'].forEach(f => { if (body[f] !== undefined) patch[f] = body[f]; });
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);
  const { data, error } = await sb.from('acc_journal_entries').update(patch).eq('id', params.id).select().single();
  if (error) return json({ error: 'Could not update entry.' }, 500);
  return json({ entry: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data: existing } = await sb.from('acc_journal_entries').select('status').eq('id', params.id).maybeSingle();
  if (!existing) return json({ error: 'Journal entry not found.' }, 404);
  if (existing.status !== 'Draft') return json({ error: 'Only draft entries can be deleted.' }, 400);

  const { error } = await sb.from('acc_journal_entries').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete entry.' }, 500);
  return json({ ok: true });
}
