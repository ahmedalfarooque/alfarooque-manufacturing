'use strict';

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');

function monthKey(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function last6Months() {
  const out = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const sb = getDb();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const sinceIso = sixMonthsAgo.toISOString();

  const [leadsRes, dealsRes, contactsRes] = await Promise.all([
    sb.from('crm_leads').select('id, status, created_at'),
    sb.from('crm_deals').select('id, stage, value, status, created_at, contact_id, crm_contacts(company)'),
    sb.from('crm_contacts').select('id, contact_type, created_at'),
  ]);
  if (leadsRes.error) console.error('[crm/analytics] leads lookup failed:', leadsRes.error.message);
  if (dealsRes.error) console.error('[crm/analytics] deals lookup failed:', dealsRes.error.message);
  if (contactsRes.error) console.error('[crm/analytics] contacts lookup failed:', contactsRes.error.message);

  const leads = leadsRes.data || [];
  const deals = dealsRes.data || [];
  const contacts = contactsRes.data || [];

  /* Lead funnel by status */
  const leadFunnel = Object.entries(leads.reduce((acc, l) => {
    const status = l.status || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {})).map(([status, count]) => ({ status, count }));

  /* Deals by stage — same shape as /api/pipeline */
  const STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];
  const dealsByStage = STAGES.map(stage => {
    const rows = deals.filter(d => d.stage === stage);
    return { stage, count: rows.length, value: rows.reduce((s, d) => s + Number(d.value || 0), 0) };
  });

  /* Top 5 companies by total deal value (via linked contact's company) */
  const companyTotals = new Map();
  for (const d of deals) {
    const company = d.crm_contacts?.company;
    if (!company) continue;
    companyTotals.set(company, (companyTotals.get(company) || 0) + Number(d.value || 0));
  }
  const topCompanies = [...companyTotals.entries()]
    .map(([company, value]) => ({ company, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  /* Contacts by type */
  const contactsByType = Object.entries(contacts.reduce((acc, c) => {
    const type = c.contact_type || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {})).map(([type, count]) => ({ type, count }));

  /* Monthly new-contacts/new-leads/new-deals for the last 6 months */
  const months = last6Months();
  const monthlyTrend = months.map(m => ({
    month: m,
    contacts: contacts.filter(c => monthKey(c.created_at) === m).length,
    leads: leads.filter(l => monthKey(l.created_at) === m).length,
    deals: deals.filter(d => monthKey(d.created_at) === m).length,
  }));

  return json({ leadFunnel, dealsByStage, topCompanies, contactsByType, monthlyTrend });
}
