'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { autoProjectName } = require('@/lib/autoProjectName');

const EDITABLE = ['customer_id', 'customer_name', 'company_name', 'contact_person', 'contact_email', 'contact_phone',
  'address', 'project_name', 'short_summary', 'project_details', 'value', 'start_date', 'end_date', 'status', 'progress', 'notes'];

export async function GET(req, { params }) {
  const { response } = requireSession(req); // any authenticated user — the View page is viewer-accessible
  if (response) return response;

  const sb = getDb();
  const { data: project, error } = await sb.from('pm_projects').select('*').eq('id', params.id).maybeSingle();
  if (error) { console.error('[projects] get failed:', error.message); return json({ error: 'Could not load project.' }, 500); }
  if (!project) return json({ error: 'Project not found.' }, 404);

  let customer = null;
  if (project.customer_id) {
    const { data } = await sb.from('customers').select('*').eq('id', project.customer_id).maybeSingle();
    customer = data || null;
  }
  const { data: documents } = await sb.from('pm_project_documents').select('*').eq('project_id', params.id).order('created_at', { ascending: false });
  const { data: assigneeRows } = await sb
    .from('pm_project_assignees')
    .select('assigned_at, platform_users(id, full_name, email, position, role)')
    .eq('project_id', params.id)
    .order('assigned_at', { ascending: true });
  const assignees = (assigneeRows || []).filter(r => r.platform_users).map(r => ({ ...r.platform_users, assigned_at: r.assigned_at }));

  return json({ project, customer, documents: documents || [], assignees });
}

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  for (const key of EDITABLE) if (key in body) patch[key] = body[key];
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  // If the project name is being cleared but details are present (or already saved), auto-generate a short name rather than saving a blank one.
  if ('project_name' in patch && !String(patch.project_name || '').trim()) {
    const detailsSource = 'project_details' in patch ? patch.project_details : (await getExistingDetails(getDb(), params.id));
    patch.project_name = autoProjectName(detailsSource);
  }

  const sb = getDb();
  const { data, error } = await sb.from('pm_projects').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[projects] update failed:', error.message); return json({ error: 'Could not update project.' }, 500); }
  if (!data) return json({ error: 'Project not found.' }, 404);

  if (patch.status) await sb.from('pm_project_logs').insert({ project_id: params.id, activity: `Status changed to ${patch.status}` });
  if ('progress' in patch) await sb.from('pm_project_logs').insert({ project_id: params.id, activity: `Completion changed to ${patch.progress}%` });
  const otherFieldsChanged = Object.keys(patch).some(k => k !== 'status' && k !== 'progress');
  if (otherFieldsChanged) await sb.from('pm_project_logs').insert({ project_id: params.id, activity: 'Project Edited' });
  return json({ project: data });
}

async function getExistingDetails(sb, id) {
  const { data } = await sb.from('pm_projects').select('project_details').eq('id', id).maybeSingle();
  return data?.project_details || '';
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('pm_projects').delete().eq('id', params.id);
  if (error) { console.error('[projects] delete failed:', error.message); return json({ error: 'Could not delete project.' }, 500); }
  return json({ ok: true });
}
