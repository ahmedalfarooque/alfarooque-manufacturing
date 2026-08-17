'use strict';

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const url = new URL(req.url);
  const q = url.searchParams;
  const search = (q.get('search') || '').trim();
  const status = q.get('status') || '';
  const page = Math.max(1, parseInt(q.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(q.get('pageSize') || '25', 10)));

  const sb = getDb();
  let query = sb.from('crm_leads').select('*', { count: 'exact' });
  if (status) query = query.eq('status', status);
  if (search) query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%`);
  query = query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) { console.error('[crm/leads] list failed:', error.message); return json({ error: 'Could not load leads.' }, 500); }
  return json({ leads: data || [], total: count || 0, page, pageSize });
}

export async function POST(req) {
  const { response, session } = await requireAction(req, 'add');
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.name) return json({ error: 'Lead name is required.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('crm_leads').insert({
    name: String(body.name).trim(),
    company: body.company || null,
    contact_person: body.contact_person || null,
    phone: body.phone || null,
    email: body.email || null,
    source: body.source || null,
    industry: body.industry || null,
    city: body.city || null,
    status: body.status || 'New',
    score: body.score != null ? Number(body.score) : null,
    notes: body.notes || null,
    next_follow_up: body.next_follow_up || null,
    assigned_to: body.assigned_to || session.sub,
    created_by: session.sub,
  }).select().single();
  if (error) { console.error('[crm/leads] create failed:', error.message); return json({ error: 'Could not create lead.' }, 500); }
  return json({ lead: data }, 201);
}
