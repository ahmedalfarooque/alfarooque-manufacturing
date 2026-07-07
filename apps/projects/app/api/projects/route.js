'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { autoProjectName } = require('@/lib/autoProjectName');

const SORTS = {
  latest: { column: 'created_at', ascending: false },
  oldest: { column: 'created_at', ascending: true },
  value: { column: 'value', ascending: false },
  name: { column: 'project_name', ascending: true },
};

export async function GET(req) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const q = url.searchParams;
  const search = (q.get('search') || '').trim();
  const status = q.get('status') || 'All';
  const company = q.get('company') || 'All';
  const customer = q.get('customer') || 'All';
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
  const projects = (data || []).map(p => ({ ...p, assignees: assigneesByProject[p.id] || [] }));

  return json({ projects, total: count || 0, page, pageSize });
}

export async function POST(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const projectDetails = String(body.project_details || '').trim();
  const projectName = String(body.project_name || '').trim();
  if (!body.customer_name) return json({ error: 'Customer is required.' }, 400);
  if (!projectName && !projectDetails) return json({ error: 'Enter a project name or the project details (a short name will be generated automatically).' }, 400);

  const sb = getDb();
  const row = {
    customer_id: body.customer_id || null,
    customer_name: body.customer_name,
    company_name: body.company_name || null,
    contact_person: body.contact_person || null,
    contact_email: body.contact_email || null,
    contact_phone: body.contact_phone || null,
    address: body.address || null,
    project_name: projectName || autoProjectName(projectDetails),
    short_summary: body.short_summary || null,
    project_details: projectDetails || null,
    value: body.value ? Number(body.value) : 0,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    status: body.status || 'Upcoming',
    progress: body.progress != null ? Math.max(0, Math.min(100, Number(body.progress))) : 0,
    notes: body.notes || null,
  };
  const { data, error } = await sb.from('pm_projects').insert(row).select().single();
  if (error) { console.error('[projects] create failed:', error.message); return json({ error: 'Could not add project.' }, 500); }

  await sb.from('pm_project_logs').insert({ project_id: data.id, activity: 'Project created' });
  return json({ project: data }, 201);
}
