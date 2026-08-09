'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const q = url.searchParams;
  const type = q.get('type') || '';
  const status = q.get('status') || '';
  const page = Math.max(1, parseInt(q.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(q.get('pageSize') || '25', 10)));

  const sb = getDb();
  let query = sb.from('crm_activities')
    .select('*, crm_contacts(name), crm_deals(title)', { count: 'exact' });
  if (type) query = query.eq('activity_type', type);
  if (status) query = query.eq('status', status);
  query = query.order('activity_date', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) { console.error('[crm/activities] list failed:', error.message); return json({ error: 'Could not load activities.' }, 500); }
  return json({ activities: data || [], total: count || 0, page, pageSize });
}

export async function POST(req) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.activity_type) return json({ error: 'Activity type is required.' }, 400);
  if (!body.subject) return json({ error: 'Subject is required.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('crm_activities').insert({
    activity_type: body.activity_type,
    subject: String(body.subject).trim(),
    activity_date: body.activity_date || new Date().toISOString().slice(0, 10),
    duration_minutes: Number(body.duration_minutes || 0),
    contact_id: body.contact_id || null,
    deal_id: body.deal_id || null,
    notes: body.notes || null,
    outcome: body.outcome || null,
    status: 'Planned',
    created_by: session.sub,
    assigned_to: body.assigned_to || session.sub,
  }).select().single();
  if (error) { console.error('[crm/activities] create failed:', error.message); return json({ error: 'Could not create activity.' }, 500); }
  return json({ activity: data }, 201);
}
