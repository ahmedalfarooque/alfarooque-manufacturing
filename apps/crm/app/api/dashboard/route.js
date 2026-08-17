'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const sb = getDb();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const [
    contactsRes, leadsRes, newCustomersRes, dealsRes, activitiesRes, dueActivitiesRes, pipelineRes,
    recentContacts, recentDeals, integrationsRes, recentQuotations, recentInvoicesRes, receivablesRes,
  ] = await Promise.all([
    sb.from('crm_contacts').select('id', { count: 'exact', head: true }),
    sb.from('crm_contacts').select('id', { count: 'exact', head: true }).eq('contact_type', 'Lead'),
    sb.from('crm_contacts').select('id', { count: 'exact', head: true }).eq('contact_type', 'Customer').gte('created_at', monthStart),
    sb.from('crm_deals').select('id, value, status'),
    sb.from('crm_activities').select('id', { count: 'exact', head: true }).gte('activity_date', monthStart),
    sb.from('crm_activities').select('id', { count: 'exact', head: true }).lte('activity_date', now.toISOString()).neq('status', 'Completed'),
    sb.from('crm_deals').select('status, value').neq('status', 'Lost').neq('status', 'Won'),
    sb.from('crm_contacts').select('id, name, company, email, created_at').order('created_at', { ascending: false }).limit(5),
    sb.from('crm_deals').select('id, title, value, status, contact_id').order('created_at', { ascending: false }).limit(5),
    sb.from('crm_integrations').select('integration_key,name,status,last_sync_at,last_error').order('name'),
    sb.from('qt_quotations').select('id, quote_number, status, grand_total, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
    sb.from('erp_financial_source_records').select('id, source_reference, party_name, total_amount, balance_amount, source_status, record_date').eq('record_type', 'sales_invoice').order('record_date', { ascending: false }).limit(5),
    sb.from('erp_financial_source_records').select('balance_amount').eq('record_type', 'sales_invoice').gt('balance_amount', 0),
  ]);

  const deals = dealsRes.data || [];
  const totalDealsValue = deals.reduce((s, d) => s + Number(d.value || 0), 0);
  const wonDeals = deals.filter(d => d.status === 'Won').length;
  const lostDealsCount = deals.filter(d => d.status === 'Lost').length;
  const pipelineValue = (pipelineRes.data || []).reduce((s, d) => s + Number(d.value || 0), 0);
  /* Conversion rate only means something once a deal has actually been
     decided (won or lost) — an open-only pipeline has nothing to divide by,
     so null (rendered as "—") is more honest than a fabricated 0%. */
  const decidedDeals = wonDeals + lostDealsCount;
  const conversionRate = decidedDeals ? Math.round((wonDeals / decidedDeals) * 1000) / 10 : null;
  const dealsByStage = Object.entries(deals.reduce((acc, d) => {
    const stage = d.status || 'Unknown';
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {})).map(([stage, count]) => ({ stage, count }));
  const outstandingReceivables = (receivablesRes.data || []).reduce((s, r) => s + Number(r.balance_amount || 0), 0);

  let totalContacts = contactsRes.count || 0;
  let dashboardContacts = recentContacts.data || [];
  if (!totalContacts) {
    const [legacyCount, legacyRecent] = await Promise.all([
      sb.from('customers').select('id', { count: 'exact', head: true }).is('deleted_at', null),
      sb.from('customers').select('id, full_name, company_name, email, created_at').is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
    ]);
    totalContacts = legacyCount.count || 0;
    dashboardContacts = (legacyRecent.data || []).map(row => ({ ...row, name: row.full_name, company: row.company_name, source_table: 'customers' }));
  }

  return json({
    totalContacts,
    totalLeads: leadsRes.count || 0,
    newCustomersThisMonth: newCustomersRes.count || 0,
    openDeals: deals.filter(d => d.status !== 'Won' && d.status !== 'Lost').length,
    totalDealsValue,
    wonDeals,
    lostDeals: lostDealsCount,
    conversionRate,
    followUpsDue: dueActivitiesRes.count || 0,
    monthActivities: activitiesRes.count || 0,
    pipelineValue,
    outstandingReceivables,
    dealsByStage,
    recentContacts: dashboardContacts,
    recentDeals: recentDeals.data || [],
    recentQuotations: recentQuotations.data || [],
    recentSalesInvoices: recentInvoicesRes.data || [],
    integrations: integrationsRes.data || [],
  });
}
