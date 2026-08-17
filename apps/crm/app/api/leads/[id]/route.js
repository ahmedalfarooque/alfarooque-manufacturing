'use strict';

const { getDb } = require('@/lib/db');
const { json, requireDelete, requireAction } = require('@/lib/http');

const EDITABLE = ['name', 'company', 'contact_person', 'phone', 'email', 'source', 'industry', 'city', 'status', 'score', 'notes', 'next_follow_up', 'assigned_to'];
const VALID_STATUSES = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'];

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('crm_leads').select('*').eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load lead.' }, 500);
  if (!data) return json({ error: 'Lead not found.' }, 404);
  return json({ lead: data });
}

export async function PATCH(req, { params }) {
  const { response } = await requireAction(req, 'edit');
  if (response) return response;

  const body = await req.json().catch(() => ({}));

  /* Convert: reuses a matching crm_contacts row if one already exists
     (exact email match, else exact phone match) instead of creating a
     duplicate — the CRM contact structure is the existing, correct target
     (not a new customer master). Only inserts a new contact when no match
     is found. Optionally creates a crm_deals row, then marks this lead
     Converted with the links kept for traceability. Never touches
     public.customers or any other app's tables. */
  if (body.action === 'convert') {
    const sb = getDb();
    const { data: lead, error: leadErr } = await sb.from('crm_leads').select('*').eq('id', params.id).maybeSingle();
    if (leadErr) return json({ error: 'Could not load lead.' }, 500);
    if (!lead) return json({ error: 'Lead not found.' }, 404);
    if (lead.status === 'Converted') return json({ error: 'Lead already converted.' }, 400);

    let contact = null;
    const leadEmail = String(lead.email || '').trim().toLowerCase();
    const leadPhone = String(lead.phone || '').replace(/\D/g, '');
    if (leadEmail) {
      const match = await sb.from('crm_contacts').select('*').ilike('email', leadEmail).limit(1).maybeSingle();
      if (match.data) contact = match.data;
    }
    if (!contact && leadPhone.length >= 6) {
      const match = await sb.from('crm_contacts').select('*').ilike('phone', `%${leadPhone}%`).limit(1).maybeSingle();
      if (match.data) contact = match.data;
    }

    if (!contact) {
      const { data: newContact, error: contactErr } = await sb.from('crm_contacts').insert({
        name: lead.name, company: lead.company, phone: lead.phone, email: lead.email,
        contact_type: 'Prospect', source: lead.source, address: lead.city, notes: lead.notes,
        assigned_to: lead.assigned_to, created_by: lead.created_by,
      }).select().single();
      if (contactErr) { console.error('[crm/leads] convert->contact failed:', contactErr.message); return json({ error: 'Could not create contact from lead.' }, 500); }
      contact = newContact;
    }

    let deal = null;
    if (body.createDeal) {
      const { data: dealRow, error: dealErr } = await sb.from('crm_deals').insert({
        title: body.dealTitle || `${lead.name} — Opportunity`,
        contact_id: contact.id, value: Number(body.dealValue || 0), stage: 'Prospecting',
        status: 'Open', assigned_to: lead.assigned_to, created_by: lead.created_by,
      }).select().single();
      if (dealErr) console.error('[crm/leads] convert->deal failed:', dealErr.message);
      else deal = dealRow;
    }

    const { data: updatedLead, error: updateErr } = await sb.from('crm_leads').update({
      status: 'Converted', converted_contact_id: contact.id, converted_deal_id: deal?.id || null, converted_at: new Date().toISOString(),
    }).eq('id', params.id).select().maybeSingle();
    if (updateErr) console.error('[crm/leads] convert status update failed:', updateErr.message);

    return json({ lead: updatedLead || lead, contact, deal });
  }

  const patch = {};
  EDITABLE.forEach(f => { if (body[f] !== undefined) patch[f] = body[f]; });
  if (patch.status && !VALID_STATUSES.includes(patch.status)) return json({ error: 'Invalid status.' }, 400);
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('crm_leads').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[crm/leads] update failed:', error.message); return json({ error: 'Could not update lead.' }, 500); }
  if (!data) return json({ error: 'Lead not found.' }, 404);
  return json({ lead: data });
}

export async function DELETE(req, { params }) {
  const { response } = await requireDelete(req);
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('crm_leads').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete lead.' }, 500);
  return json({ ok: true });
}
