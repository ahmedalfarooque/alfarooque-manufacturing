'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'summary';
  const from = url.searchParams.get('from') || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  const to = url.searchParams.get('to') || new Date().toISOString().slice(0, 10);

  const sb = getDb();

  if (type === 'deals') {
    const { data } = await sb.from('crm_deals').select('status, stage, value, created_at').gte('created_at', from).lte('created_at', to + 'T23:59:59');
    const deals = data || [];
    const byStatus = {};
    deals.forEach(d => { byStatus[d.status] = (byStatus[d.status] || 0) + 1; });
    const byStage = {};
    deals.forEach(d => { byStage[d.stage] = (byStage[d.stage] || 0) + 1; });
    const totalValue = deals.reduce((s, d) => s + Number(d.value || 0), 0);
    const wonValue = deals.filter(d => d.status === 'Won').reduce((s, d) => s + Number(d.value || 0), 0);
    return json({ type, from, to, total: deals.length, total_value: totalValue, won_value: wonValue, by_status: byStatus, by_stage: byStage });
  }

  if (type === 'activities') {
    const { data } = await sb.from('crm_activities').select('activity_type, status, created_at').gte('created_at', from).lte('created_at', to + 'T23:59:59');
    const activities = data || [];
    const byType = {};
    activities.forEach(a => { byType[a.activity_type] = (byType[a.activity_type] || 0) + 1; });
    const completed = activities.filter(a => a.status === 'Completed').length;
    return json({ type, from, to, total: activities.length, completed, by_type: byType });
  }

  const [contacts, deals, activities] = await Promise.all([
    sb.from('crm_contacts').select('id', { count: 'exact', head: true }),
    sb.from('crm_deals').select('id, value, status'),
    sb.from('crm_activities').select('id', { count: 'exact', head: true }).eq('status', 'Completed'),
  ]);

  const dealsData = deals.data || [];
  return json({
    type: 'summary',
    total_contacts: contacts.count || 0,
    total_deals: dealsData.length,
    won_deals: dealsData.filter(d => d.status === 'Won').length,
    lost_deals: dealsData.filter(d => d.status === 'Lost').length,
    pipeline_value: dealsData.filter(d => d.status === 'Open').reduce((s, d) => s + Number(d.value || 0), 0),
    won_value: dealsData.filter(d => d.status === 'Won').reduce((s, d) => s + Number(d.value || 0), 0),
    completed_activities: activities.count || 0,
  });
}
