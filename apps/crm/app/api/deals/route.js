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
  let query = sb.from('crm_deals')
    .select('*, crm_contacts(name, company)', { count: 'exact' });
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`title.ilike.%${search}%`);
  query = query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) { console.error('[crm/deals] list failed:', error.message); return json({ error: 'Could not load deals.' }, 500); }
  return json({ deals: data || [], total: count || 0, page, pageSize });
}

export async function POST(req) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.title) return json({ error: 'Deal title is required.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('crm_deals').insert({
    title: String(body.title).trim(),
    contact_id: body.contact_id || null,
    value: Number(body.value || 0),
    currency: body.currency || 'SAR',
    stage: body.stage || 'Prospecting',
    status: 'Open',
    probability: Number(body.probability || 0),
    expected_close_date: body.expected_close_date || null,
    description: body.description || null,
    assigned_to: body.assigned_to || session.sub,
    created_by: session.sub,
  }).select().single();
  if (error) { console.error('[crm/deals] create failed:', error.message); return json({ error: 'Could not create deal.' }, 500); }
  return json({ deal: data }, 201);
}
