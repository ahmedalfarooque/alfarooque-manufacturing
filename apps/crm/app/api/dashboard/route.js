'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const [contactsRes, dealsRes, activitiesRes, pipelineRes, recentContacts, recentDeals] = await Promise.all([
    sb.from('crm_contacts').select('id', { count: 'exact', head: true }),
    sb.from('crm_deals').select('id, value, status'),
    sb.from('crm_activities').select('id', { count: 'exact', head: true }).gte('activity_date', monthStart),
    sb.from('crm_deals').select('status, value').neq('status', 'Lost').neq('status', 'Won'),
    sb.from('crm_contacts').select('id, name, company, email, created_at').order('created_at', { ascending: false }).limit(5),
    sb.from('crm_deals').select('id, title, value, status, contact_id').order('created_at', { ascending: false }).limit(5),
  ]);

  const deals = dealsRes.data || [];
  const totalDealsValue = deals.reduce((s, d) => s + Number(d.value || 0), 0);
  const wonDeals = deals.filter(d => d.status === 'Won').length;
  const pipelineValue = (pipelineRes.data || []).reduce((s, d) => s + Number(d.value || 0), 0);

  return json({
    totalContacts: contactsRes.count || 0,
    totalDealsValue,
    wonDeals,
    monthActivities: activitiesRes.count || 0,
    pipelineValue,
    recentContacts: recentContacts.data || [],
    recentDeals: recentDeals.data || [],
  });
}
