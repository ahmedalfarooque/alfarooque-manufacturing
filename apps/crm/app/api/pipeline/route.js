'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('crm_deals')
    .select('id, title, value, stage, status, probability, expected_close_date, crm_contacts(name, company)')
    .eq('status', 'Open')
    .order('created_at', { ascending: false });

  if (error) { console.error('[crm/pipeline] list failed:', error.message); return json({ error: 'Could not load pipeline.' }, 500); }

  const deals = data || [];
  const pipeline = STAGES.map(stage => ({
    stage,
    deals: deals.filter(d => d.stage === stage),
    total_value: deals.filter(d => d.stage === stage).reduce((s, d) => s + Number(d.value || 0), 0),
    count: deals.filter(d => d.stage === stage).length,
  }));

  return json({ pipeline, total_open: deals.length, total_value: deals.reduce((s, d) => s + Number(d.value || 0), 0) });
}
