'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { buildProjectRow } = require('@/lib/createProjectRow');

const SORTS = {
  latest: { column: 'created_at', ascending: false },
  oldest: { column: 'created_at', ascending: true },
  value: { column: 'value', ascending: false },
  name: { column: 'project_name', ascending: true },
};

export async function GET(req) {
  const { response, session } = await requireAction(req, 'view');
  if (response) return response;

  const url = new URL(req.url);
  const q = url.searchParams;
  const search = (q.get('search') || '').trim();
  const status = q.get('status') || 'All';
  const company = q.get('company') || 'All';
  const customer = q.get('customer') || 'All';
  const assignedUser = q.get('assignedUser') || 'All';
  const sort = SORTS[q.get('sort')] || SORTS.latest;
  const page = Math.max(1, parseInt(q.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(q.get('pageSize') || '10', 10)));

  const sb = getDb();

  /* External users have no visibility into the wider project list —
     only the projects they're explicitly assigned to. Everyone else
     (admin/viewer) keeps the unrestricted list. */
  let assignedOnlyIds = null;
  if (session.role === 'external') {
    const { data: rows } = await sb.from('pm_project_assignees').select('project_id').eq('user_id', session.sub);
    assignedOnlyIds = (rows || []).map(r => r.project_id);
    if (!assignedOnlyIds.length) return json({ projects: [], total: 0, page, pageSize });
  }

  if (assignedUser !== 'All') {
    const { data: rows } = await sb.from('pm_project_assignees').select('project_id').eq('user_id', assignedUser);
    const ids = (rows || []).map(r => r.project_id);
    assignedOnlyIds = assignedOnlyIds ? assignedOnlyIds.filter(id => ids.includes(id)) : ids;
    if (!assignedOnlyIds.length) return json({ projects: [], total: 0, page, pageSize });
  }

  let query = sb.from('pm_projects').select('*', { count: 'exact' });
  if (assignedOnlyIds) query = query.in('id', assignedOnlyIds);
  if (search) query = query.or(`project_name.ilike.%${search}%,customer_name.ilike.%${search}%,company_name.ilike.%${search}%`);
  if (status !== 'All') query = query.eq('status', status);
  if (company !== 'All') query = query.eq('company_name', company);
  if (customer !== 'All') query = query.eq('customer_name', customer);

  query = query.order(sort.column, { ascending: sort.ascending })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) { console.error('[projects] list failed:', error.message); return json({ error: 'Could not load projects.' }, 500); }

  // Batch-fetch assignee names for just this page's projects — backs the "Assigned Users" avatar-chip column on the list.
  const ids = (data || []).map(p => p.id);
  let assigneesByProject = {};
  if (ids.length) {
    const { data: rows } = await sb
      .from('pm_project_assignees')
      .select('project_id, platform_users(id, full_name)')
      .in('project_id', ids);
    for (const r of rows || []) {
      if (!r.platform_users) continue;
      (assigneesByProject[r.project_id] ||= []).push({ id: r.platform_users.id, full_name: r.platform_users.full_name });
    }
  }
  /* Paid Amount = sum, per connected sales invoice, of reflected_paid =
     max(SmartLife's own paid_amount, local ERP payments recorded on top of
     it) — the SAME canonical calculation the Financials tab summary uses
     (never just erp_project_payments alone, which misses a sales invoice
     that SmartLife already shows as paid with zero local ERP rows; never
     planned/requested Purchase Request amounts; never sales-invoice totals
     — that would be Revenue, not Paid Amount). Balance To Pay = value - paidAmount. */
  let paidByProject = {};
  if (ids.length) {
    const { data: connections } = await sb.from('erp_financial_connections').select('project_id, source_record_id').in('project_id', ids);
    const sourceIds = [...new Set((connections || []).map(c => c.source_record_id))];
    if (sourceIds.length) {
      const [{ data: sources }, { data: localPayments }] = await Promise.all([
        sb.from('erp_financial_source_records').select('id, record_type, paid_amount').in('id', sourceIds).eq('record_type', 'sales_invoice'),
        sb.from('erp_project_payments').select('project_id, source_record_id, amount').eq('direction', 'received').in('project_id', ids),
      ]);
      const sourceById = new Map((sources || []).map(s => [s.id, s]));
      const localPaidBySource = new Map();
      for (const p of localPayments || []) {
        const key = p.project_id + ':' + p.source_record_id;
        localPaidBySource.set(key, (localPaidBySource.get(key) || 0) + Number(p.amount || 0));
      }
      for (const c of connections || []) {
        const source = sourceById.get(c.source_record_id);
        if (!source) continue; // not a sales invoice (e.g. a connected purchase) — never counted as received payment
        const localPaid = localPaidBySource.get(c.project_id + ':' + c.source_record_id) || 0;
        const reflectedPaid = Math.max(Number(source.paid_amount || 0), localPaid);
        paidByProject[c.project_id] = (paidByProject[c.project_id] || 0) + reflectedPaid;
      }
    }
  }
  const projects = (data || []).map(p => {
    const paidAmount = paidByProject[p.id] || 0;
    return { ...p, assignees: assigneesByProject[p.id] || [], paid_amount: paidAmount, balance_to_pay: Math.max(Number(p.value || 0) - paidAmount, 0) };
  });

  return json({ projects, total: count || 0, page, pageSize });
}

export async function POST(req) {
  const { response } = await requireAction(req, 'add');
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const projectDetails = String(body.project_details || '').trim();
  const projectName = String(body.project_name || '').trim();
  if (!body.customer_name) return json({ error: 'Customer is required.' }, 400);
  if (!projectName && !projectDetails) return json({ error: 'Enter a project name or the project details (a short name will be generated automatically).' }, 400);

  const sb = getDb();
  const row = buildProjectRow(body);
  const { data, error } = await sb.from('pm_projects').insert(row).select().single();
  if (error) { console.error('[projects] create failed:', error.message); return json({ error: 'Could not add project.' }, 500); }

  await sb.from('pm_project_logs').insert({ project_id: data.id, activity: 'Project created' });
  return json({ project: data }, 201);
}
