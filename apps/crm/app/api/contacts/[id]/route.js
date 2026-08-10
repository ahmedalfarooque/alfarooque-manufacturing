'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, requireDelete } = require('@/lib/http');
const { readSmartLife } = require('../../../../../shared/integrationPlatform');

const EDITABLE = ['name', 'email', 'phone', 'company', 'job_title', 'contact_type', 'source', 'address', 'notes', 'tags', 'assigned_to', 'status'];

const clean = value => String(value || '').trim().toLowerCase();
const phone = value => String(value || '').replace(/\D/g, '');
const amount = value => Number(value || 0) || 0;

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  let { data, error } = await sb.from('crm_contacts').select('*').eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load contact.' }, 500);
  if (!data) {
    const legacy = await sb.from('customers').select('*').eq('id', params.id).is('deleted_at', null).maybeSingle();
    if (legacy.error) return json({ error: 'Could not load contact.' }, 500);
    if (legacy.data) data = { ...legacy.data, name: legacy.data.full_name, phone: legacy.data.mobile_number, company: legacy.data.company_name, contact_type: legacy.data.customer_type || 'Customer', source_table: 'customers' };
  }
  if (!data) return json({ error: 'Contact not found.' }, 404);

  const identityRes = await sb.from('crm_customer_identities').select('*').eq('crm_contact_id', params.id).maybeSingle();
  const identity = identityRes.data || null;
  const mappingsRes = identity ? await sb.from('crm_record_mappings').select('*').eq('customer_identity_id', identity.id).order('source_system') : { data: [] };
  const mappings = mappingsRes.data || [];
  const sourceIds = source => mappings.filter(m => m.source_system === source).map(m => m.source_record_id);
  const quotationCustomerIds = sourceIds('quotation');
  const projectIds = sourceIds('projects');

  const [deals, activities, timeline, quotations, projects] = await Promise.all([
    sb.from('crm_deals').select('id, title, value, status').eq('contact_id', params.id).order('created_at', { ascending: false }),
    sb.from('crm_activities').select('*').eq('contact_id', params.id).order('activity_date', { ascending: false }).limit(10),
    identity ? sb.from('crm_timeline_events').select('*').eq('customer_identity_id', identity.id).order('occurred_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    quotationCustomerIds.length ? sb.from('qt_quotations').select('id,quote_number,status,grand_total,created_at,project_id,customer_approval_status').in('customer_id', quotationCustomerIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    projectIds.length ? sb.from('pm_projects').select('id,project_name,status,progress_percent,created_at,quotation_id').in('id', projectIds).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
  ]);

  let smartErp = { connected: false, customers: [], suppliers: [], invoices: [], summary: { invoiced: 0, paid: 0, outstanding: 0 } };
  try {
    const [customerResult, supplierResult, salesResult] = await Promise.all([
      readSmartLife(sb, 'customers'),
      readSmartLife(sb, 'suppliers'),
      readSmartLife(sb, 'sales-invoices'),
    ]);
    const mappedIds = new Set(mappings.filter(mapping => ['smartlife','smarterp'].includes(clean(mapping.source_system))).map(mapping => String(mapping.source_record_id)));
    const email = clean(data.email);
    const mobile = phone(data.phone || data.mobile_number);
    const names = new Set([clean(data.name), clean(data.company)].filter(Boolean));
    const matches = record => mappedIds.has(String(record?.id)) || (email && clean(record?.email) === email) || (mobile.length >= 6 && phone(record?.phone || record?.mobile) === mobile);
    const customers = customerResult.records.filter(matches);
    const suppliers = supplierResult.records.filter(matches);
    const externalIds = new Set([...mappedIds, ...customers.map(record => String(record?.id)), ...suppliers.map(record => String(record?.id))]);
    const invoices = salesResult.records.filter(record => externalIds.has(String(record?.customer_id)) || names.has(clean(record?.customer)));
    const invoiced = invoices.reduce((sum, record) => sum + amount(record?.grand_total ?? record?.total_amount ?? record?.total), 0);
    const paid = invoices.reduce((sum, record) => sum + amount(record?.paid), 0);
    smartErp = { connected: true, customers, suppliers, invoices, summary: { invoiced, paid, outstanding: Math.max(0, invoiced - paid) } };
  } catch (_) {
    // Customer 360 remains available when the external read-only service is offline.
  }

  return json({ contact: data, deals: deals.data || [], activities: activities.data || [], customer360: { identity, mappings, timeline: timeline.data || [], quotations: quotations.data || [], projects: projects.data || [], smartErp } });
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
  const { response } = await requireDelete(req);
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('crm_contacts').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete contact.' }, 500);
  return json({ ok: true });
}
