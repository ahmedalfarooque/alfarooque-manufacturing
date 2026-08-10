'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const [contactsRes, leadsRes, dealsRes, activitiesRes, dueActivitiesRes, pipelineRes, recentContacts, recentDeals, integrationsRes] = await Promise.all([
    sb.from('crm_contacts').select('id', { count: 'exact', head: true }),
    sb.from('crm_contacts').select('id', { count: 'exact', head: true }).eq('contact_type', 'Lead'),
    sb.from('crm_deals').select('id, value, status'),
    sb.from('crm_activities').select('id', { count: 'exact', head: true }).gte('activity_date', monthStart),
    sb.from('crm_activities').select('id', { count: 'exact', head: true }).lte('activity_date', now.toISOString()).neq('status', 'Completed'),
    sb.from('crm_deals').select('status, value').neq('status', 'Lost').neq('status', 'Won'),
    sb.from('crm_contacts').select('id, name, company, email, created_at').order('created_at', { ascending: false }).limit(5),
    sb.from('crm_deals').select('id, title, value, status, contact_id').order('created_at', { ascending: false }).limit(5),
    sb.from('crm_integrations').select('integration_key,name,status,last_sync_at,last_error').order('name'),
  ]);

  const deals = dealsRes.data || [];
  const totalDealsValue = deals.reduce((s, d) => s + Number(d.value || 0), 0);
  const wonDeals = deals.filter(d => d.status === 'Won').length;
  const pipelineValue = (pipelineRes.data || []).reduce((s, d) => s + Number(d.value || 0), 0);

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
    openDeals: deals.filter(d => d.status !== 'Won' && d.status !== 'Lost').length,
    totalDealsValue,
    wonDeals,
    lostDeals: deals.filter(d => d.status === 'Lost').length,
    followUpsDue: dueActivitiesRes.count || 0,
    monthActivities: activitiesRes.count || 0,
    pipelineValue,
    recentContacts: dashboardContacts,
    recentDeals: recentDeals.data || [],
    integrations: integrationsRes.data || [],
  });
}
