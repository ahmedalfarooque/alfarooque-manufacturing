'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = ['activity_type', 'subject', 'activity_date', 'duration_minutes', 'contact_id', 'deal_id', 'notes', 'outcome', 'status', 'assigned_to'];
const VALID_STATUSES = ['Planned', 'Completed', 'Cancelled', 'No Show'];

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('crm_activities')
    .select('*, crm_contacts(name, company), crm_deals(title)')
    .eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load activity.' }, 500);
  if (!data) return json({ error: 'Activity not found.' }, 404);
  return json({ activity: data });
}

export async function PATCH(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  EDITABLE.forEach(f => { if (body[f] !== undefined) patch[f] = body[f]; });
  if (patch.status && !VALID_STATUSES.includes(patch.status)) return json({ error: 'Invalid status.' }, 400);
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('crm_activities').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[crm/activities] update failed:', error.message); return json({ error: 'Could not update activity.' }, 500); }
  if (!data) return json({ error: 'Activity not found.' }, 404);
  return json({ activity: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('crm_activities').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete activity.' }, 500);
  return json({ ok: true });
}
