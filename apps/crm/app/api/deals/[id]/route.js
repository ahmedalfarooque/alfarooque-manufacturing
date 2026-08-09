'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = ['title', 'contact_id', 'value', 'currency', 'stage', 'status', 'probability', 'expected_close_date', 'description', 'assigned_to', 'linked_quotation_id', 'linked_project_id'];
const VALID_STATUSES = ['Open', 'Won', 'Lost', 'On Hold'];
const STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('crm_deals')
    .select('*, crm_contacts(name, company, email, phone)')
    .eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load deal.' }, 500);
  if (!data) return json({ error: 'Deal not found.' }, 404);

  const { data: activities } = await sb.from('crm_activities')
    .select('*').eq('deal_id', params.id).order('activity_date', { ascending: false }).limit(20);

  /* Reads qt_quotations / pm_projects directly (same Supabase project) to
     show the human-readable label for a linked record — no data is
     duplicated, just a name lookup for display. */
  let linkedQuotation = null;
  let linkedProject = null;
  if (data.linked_quotation_id) {
    const { data: q } = await sb.from('qt_quotations').select('id, quote_number, status').eq('id', data.linked_quotation_id).maybeSingle();
    linkedQuotation = q || null;
  }
  if (data.linked_project_id) {
    const { data: p } = await sb.from('pm_projects').select('id, project_name, customer_name').eq('id', data.linked_project_id).maybeSingle();
    linkedProject = p || null;
  }

  return json({ deal: data, activities: activities || [], linkedQuotation, linkedProject });
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
  const { data, error } = await sb.from('crm_deals').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[crm/deals] update failed:', error.message); return json({ error: 'Could not update deal.' }, 500); }
  if (!data) return json({ error: 'Deal not found.' }, 404);
  return json({ deal: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('crm_deals').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete deal.' }, 500);
  return json({ ok: true });
}
