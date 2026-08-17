'use strict';

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2) return json({ results: [], q });

  const sb = getDb();
  const like = `%${q}%`;
  const [contacts, leads, deals, quotations] = await Promise.all([
    sb.from('crm_contacts').select('id, name, company, email').or(`name.ilike.${like},company.ilike.${like},email.ilike.${like}`).limit(10),
    sb.from('crm_leads').select('id, name, company').or(`name.ilike.${like},company.ilike.${like}`).limit(10),
    sb.from('crm_deals').select('id, title, value').ilike('title', like).limit(10),
    sb.from('qt_quotations').select('id, quote_number, status').ilike('quote_number', like).limit(10),
  ]);
  if (contacts.error) console.error('[crm/search] contacts failed:', contacts.error.message);
  if (leads.error) console.error('[crm/search] leads failed:', leads.error.message);
  if (deals.error) console.error('[crm/search] deals failed:', deals.error.message);
  if (quotations.error) console.error('[crm/search] quotations failed:', quotations.error.message);

  const results = [];
  for (const c of contacts.data || []) results.push({ type: 'CRM Contact', id: c.id, label: c.name, sublabel: c.company || c.email || '', href: `/contacts/${c.id}` });
  for (const l of leads.data || []) results.push({ type: 'CRM Lead', id: l.id, label: l.name, sublabel: l.company || '', href: '/leads' });
  for (const d of deals.data || []) results.push({ type: 'CRM Deal', id: d.id, label: d.title, sublabel: d.value ? `SAR ${Number(d.value).toLocaleString()}` : '', href: `/deals/${d.id}` });
  for (const qt of quotations.data || []) results.push({ type: 'QuotePro Quotation', id: qt.id, label: qt.quote_number, sublabel: qt.status || '', href: null });

  return json({ results, q });
}
