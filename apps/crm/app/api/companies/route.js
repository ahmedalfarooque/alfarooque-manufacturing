'use strict';

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');

/* Companies is a virtual grouping over crm_contacts.company (falling back to
   public.customers.company_name exactly like /api/contacts does when
   crm_contacts is empty) — no dedicated companies table exists or is needed.
   Read-only aggregation across two already-established tables. */
export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const url = new URL(req.url);
  const search = (url.searchParams.get('search') || '').trim().toLowerCase();

  const sb = getDb();
  let { data: contacts, error, count } = await sb.from('crm_contacts')
    .select('id, company', { count: 'exact' }).not('company', 'is', null);
  if (error) { console.error('[crm/companies] list failed:', error.message); return json({ error: 'Could not load companies.' }, 500); }

  let sourceTable = 'crm_contacts';
  if (!count) {
    const legacy = await sb.from('customers').select('id, company_name').is('deleted_at', null).not('company_name', 'is', null);
    if (!legacy.error) {
      contacts = (legacy.data || []).map(r => ({ id: r.id, company: r.company_name }));
      sourceTable = 'customers';
    }
  }

  const groups = new Map();
  for (const c of (contacts || [])) {
    const name = String(c.company || '').trim();
    if (!name) continue;
    if (!groups.has(name)) groups.set(name, { company: name, contactIds: [] });
    groups.get(name).contactIds.push(c.id);
  }

  let rows = [...groups.values()];

  /* Deal aggregation only applies when the contact ids come from crm_contacts
     — crm_deals.contact_id has no relationship to public.customers rows. */
  let dealsByContact = new Map();
  if (sourceTable === 'crm_contacts') {
    const allIds = rows.flatMap(r => r.contactIds);
    if (allIds.length) {
      const { data: deals, error: dealsErr } = await sb.from('crm_deals').select('contact_id, value, status').in('contact_id', allIds);
      if (dealsErr) console.error('[crm/companies] deals lookup failed:', dealsErr.message);
      for (const d of deals || []) {
        if (!dealsByContact.has(d.contact_id)) dealsByContact.set(d.contact_id, []);
        dealsByContact.get(d.contact_id).push(d);
      }
    }
  }

  let result = rows.map(r => {
    const deals = r.contactIds.flatMap(id => dealsByContact.get(id) || []);
    return {
      company: r.company,
      contactCount: r.contactIds.length,
      openDeals: deals.filter(d => d.status === 'Open').length,
      totalDealValue: deals.reduce((s, d) => s + Number(d.value || 0), 0),
      sourceTable,
    };
  });

  if (search) result = result.filter(r => r.company.toLowerCase().includes(search));
  result.sort((a, b) => a.company.localeCompare(b.company));

  return json({ companies: result, total: result.length });
}
