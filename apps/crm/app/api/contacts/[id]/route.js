'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, requireDelete , requireAction } = require('@/lib/http');
const { readSmartLife, classifySmartErpError } = require('../../../../../shared/integrationPlatform');

const EDITABLE = ['name', 'email', 'phone', 'company', 'job_title', 'contact_type', 'source', 'address', 'notes', 'tags', 'assigned_to', 'status'];

const clean = value => String(value || '').trim().toLowerCase();
const phone = value => String(value || '').replace(/\D/g, '');
const amount = value => Number(value || 0) || 0;

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
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

  /* Sales Orders live in ProTrack (`sales_orders`), keyed to a quotation
     (quotation_id → qt_quotations.id), not directly to a customer — so this
     customer's orders are found via the quotation ids already resolved above.
     Read-only join across apps, same pattern as quotations/projects. */
  const quotationIds = (quotations.data || []).map(q => q.id).filter(Boolean);
  const salesOrders = quotationIds.length
    ? await sb.from('sales_orders').select('id,so_number,status,total_amount,currency,created_at,project_id,quotation_id').in('quotation_id', quotationIds).order('created_at', { ascending: false })
    : { data: [] };
  if (salesOrders.error) console.error('[crm/customer360] sales_orders lookup failed:', salesOrders.error.message);

  /* Customer-360 must remain useful when SmartERP denies live module access.
     The synchronized source table is local, read-only snapshot data already
     owned by the central integration. Match explicit SmartERP mappings first,
     then exact customer/company names as a conservative legacy fallback. */
  const mappedSmartErpIds = [...new Set(mappings
    .filter(mapping => ['smartlife', 'smarterp'].includes(clean(mapping.source_system)))
    .map(mapping => String(mapping.source_record_id))
    .filter(Boolean))];
  const partyNames = [...new Set([data.name, data.company, data.full_name, data.company_name]
    .map(value => String(value || '').trim())
    .filter(Boolean))];
  const financialQueries = [];
  const financialSelect = 'id,external_id,source_reference,party_name,record_date,due_date,currency,total_amount,paid_amount,balance_amount,source_status,last_synced_at,raw_payload';
  if (mappedSmartErpIds.length) {
    financialQueries.push(sb.from('erp_financial_source_records').select(financialSelect)
      .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('record_type', 'sales_invoice')
      .in('raw_payload->>customer_id', mappedSmartErpIds));
  } else if (partyNames.length) {
    /* Exact-name matching is only a fallback for legacy customers that have
       no explicit mapping yet. Once a source ID exists, never widen the match
       by name and risk combining two customers with the same display name. */
    financialQueries.push(sb.from('erp_financial_source_records').select(financialSelect)
      .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('record_type', 'sales_invoice')
      .in('party_name', partyNames));
  }
  const financialResults = await Promise.all(financialQueries);
  const snapshotById = new Map();
  for (const result of financialResults) {
    if (result.error) console.error('[crm/customer360] synchronized finance lookup failed:', result.error.message);
    for (const record of result.data || []) snapshotById.set(record.id, record);
  }
  const snapshotInvoices = [...snapshotById.values()].sort((a, b) => String(b.record_date || '').localeCompare(String(a.record_date || '')));
  const snapshotSummary = snapshotInvoices.reduce((summary, record) => ({
    invoiced: summary.invoiced + amount(record.total_amount),
    paid: summary.paid + amount(record.paid_amount),
    outstanding: summary.outstanding + amount(record.balance_amount),
  }), { invoiced: 0, paid: 0, outstanding: 0 });

  /* `status` mirrors the same taxonomy used by Accounting's SmartERP UI
     (connected / permission_required / endpoint_or_version_mismatch /
     connection_error / other_error) so this card can say "Permission
     required" instead of a generic "Offline" once the badge below reads it. */
  let smartErp = {
    connected: false,
    status: 'pending',
    source: snapshotInvoices.length ? 'synchronized_snapshot' : 'none',
    customers: [], suppliers: [], invoices: snapshotInvoices, summary: snapshotSummary,
    lastSyncedAt: snapshotInvoices[0]?.last_synced_at || null,
  };
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
    smartErp = {
      connected: true, status: 'connected', source: 'live', customers, suppliers, invoices,
      summary: { invoiced, paid, outstanding: Math.max(0, invoiced - paid) },
      lastSyncedAt: snapshotInvoices[0]?.last_synced_at || null,
    };
  } catch (smartErpError) {
    // Customer 360 remains available when the external read-only service is degraded — just classify why.
    smartErp.status = classifySmartErpError(smartErpError);
  }

  return json({ contact: data, deals: deals.data || [], activities: activities.data || [], customer360: { identity, mappings, timeline: timeline.data || [], quotations: quotations.data || [], projects: projects.data || [], salesOrders: salesOrders.data || [], smartErp } });
}

export async function PATCH(req, { params }) {
  const { response } = await requireAction(req, 'edit');
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
