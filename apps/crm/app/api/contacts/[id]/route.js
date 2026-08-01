'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = ['name', 'email', 'phone', 'company', 'job_title', 'contact_type', 'source', 'address', 'notes', 'tags', 'assigned_to', 'status'];

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('crm_contacts').select('*').eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load contact.' }, 500);
  if (!data) return json({ error: 'Contact not found.' }, 404);

  const [deals, activities] = await Promise.all([
    sb.from('crm_deals').select('id, title, value, status').eq('contact_id', params.id).order('created_at', { ascending: false }),
    sb.from('crm_activities').select('*').eq('contact_id', params.id).order('activity_date', { ascending: false }).limit(10),
  ]);

  return json({ contact: data, deals: deals.data || [], activities: activities.data || [] });
}

export async function PATCH(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  EDITABLE.forEach(f => { if (body[f] !== undefined) patch[f] = body[f]; });
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('crm_contacts').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[crm/contacts] update failed:', error.message); return json({ error: 'Could not update contact.' }, 500); }
  if (!data) return json({ error: 'Contact not found.' }, 404);
  return json({ contact: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('crm_contacts').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete contact.' }, 500);
  return json({ ok: true });
}
