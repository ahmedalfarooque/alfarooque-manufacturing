'use strict';

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const companyName = decodeURIComponent(params.name || '').trim();
  if (!companyName) return json({ error: 'Company name is required.' }, 400);

  const sb = getDb();
  let { data: contacts, error } = await sb.from('crm_contacts').select('*').ilike('company', companyName);
  if (error) { console.error('[crm/companies/name] contacts lookup failed:', error.message); return json({ error: 'Could not load company.' }, 500); }

  let sourceTable = 'crm_contacts';
  if (!contacts || !contacts.length) {
    const legacy = await sb.from('customers').select('*').ilike('company_name', companyName).is('deleted_at', null);
    if (!legacy.error && legacy.data && legacy.data.length) {
      contacts = legacy.data.map(r => ({ ...r, name: r.full_name, phone: r.mobile_number, company: r.company_name, contact_type: r.customer_type || 'Customer', source_table: 'customers' }));
      sourceTable = 'customers';
    }
  }
  contacts = contacts || [];

  let deals = [];
  if (sourceTable === 'crm_contacts') {
    const contactIds = contacts.map(c => c.id);
    if (contactIds.length) {
      const dealsRes = await sb.from('crm_deals').select('*').in('contact_id', contactIds).order('created_at', { ascending: false });
      if (dealsRes.error) console.error('[crm/companies/name] deals lookup failed:', dealsRes.error.message);
      deals = dealsRes.data || [];
    }
  }

  return json({ company: companyName, contacts, deals, sourceTable });
}
