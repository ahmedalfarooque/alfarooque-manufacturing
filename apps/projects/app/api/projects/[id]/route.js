'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, isAssignedOrAdmin } = require('@/lib/http');
const { autoProjectName } = require('@/lib/autoProjectName');

const EDITABLE = ['customer_id', 'customer_name', 'company_name', 'contact_person', 'contact_email', 'contact_phone',
  'address', 'project_name', 'short_summary', 'project_details', 'value', 'start_date', 'end_date', 'status', 'progress', 'notes'];

export async function GET(req, { params }) {
  const { response, session } = requireSession(req); // any authenticated user — the View page is viewer-accessible; external users are further gated below to only their assigned project
  if (response) return response;
  if (session.role === 'external' && !(await isAssignedOrAdmin(session, params.id))) {
    return json({ error: 'Project not found.' }, 404);
  }

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
    .select('assigned_at, platform_users(id, full_name, email, position, role, phone, department, photo_url, status)')
    .eq('project_id', params.id)
    .order('assigned_at', { ascending: true });
  const assignees = (assigneeRows || []).filter(r => r.platform_users).map(r => ({ ...r.platform_users, assigned_at: r.assigned_at }));

  return json({ project, customer, documents: documents || [], assignees });
}

export async function PATCH(req, { params }) {
  const { response, session } = requireSession(req, { adminOnly: true });
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

  if (patch.status) {
    await sb.from('pm_project_logs').insert({ project_id: params.id, activity: `Status changed to ${patch.status}` });
    /* Sync live status back into the source quotation, if this project
       was created from one (Part 10) — same Postgres instance, direct
       write, no HTTP call needed. No-op (0 rows) for manually-created
       projects with no linked quotation. */
    await sb.from('qt_quotations').update({ project_status: patch.status }).eq('project_id', params.id).catch(() => {});
  }
  if ('progress' in patch) await sb.from('pm_project_logs').insert({ project_id: params.id, activity: `Completion changed to ${patch.progress}%` });
  const otherFieldsChanged = Object.keys(patch).some(k => k !== 'status' && k !== 'progress');
  if (otherFieldsChanged) await sb.from('pm_project_logs').insert({ project_id: params.id, activity: 'Project Edited' });

  const { data: assignees } = await sb.from('pm_project_assignees').select('user_id').eq('project_id', params.id);
  const notifyIds = (assignees || []).map(a => a.user_id).filter(id => id !== session.sub);
  if (notifyIds.length) {
    const summary = patch.status ? `Status changed to ${patch.status}` : 'Project details updated';
    await sb.from('notifications').insert(notifyIds.map(uid => ({
      user_id: uid, type: 'project_updated', project_id: params.id,
      title: 'Project Updated', body: summary,
      link: `/projects/${params.id}`,
    }))).catch(() => {});
  }

  return json({ project: data });
}

async function getExistingDetails(sb, id) {
  const { data } = await sb.from('pm_projects').select('project_details').eq('id', id).maybeSingle();
  return data?.project_details || '';
}

export async function DELETE(req, { params }) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  /* Admin can delete ANY project regardless of status (Draft, Pending,
     Running, On Hold, Completed, Cancelled, …).

     Why deletes used to fail for Running/Completed projects: those are
     typically created from a quotation, so qt_quotations.project_id and
     project_requests.project_id point at them — both plain FKs with NO
     cascade. Postgres rejected the delete with an FK violation, which
     surfaced as a generic "Could not delete project." and looked like a
     status-based restriction. The fix is data-level unlinking (no schema
     change): the quotation and the original request row survive, they
     just stop pointing at the deleted project. Everything project-owned
     (logs, documents, assignees, purchase requests, daily updates,
     notifications) is still removed by the existing `on delete cascade`
     FKs, exactly as before. Non-admins never reach this handler —
     requireSession(adminOnly) above is unchanged. */
  const { error: qErr } = await sb.from('qt_quotations')
    .update({ project_id: null, project_status: null })
    .eq('project_id', params.id);
  if (qErr) { console.error('[projects] delete: unlink quotation failed:', qErr.message); return json({ error: 'Could not delete project.' }, 500); }

  const { error: rErr } = await sb.from('project_requests')
    .update({ project_id: null })
    .eq('project_id', params.id);
  if (rErr) { console.error('[projects] delete: unlink project request failed:', rErr.message); return json({ error: 'Could not delete project.' }, 500); }

  const { error } = await sb.from('pm_projects').delete().eq('id', params.id);
  if (error) { console.error('[projects] delete failed:', error.message); return json({ error: 'Could not delete project.' }, 500); }

  /* Audit trail: who deleted what, when. The per-project activity log
     rows cascade away with the project itself, so this goes to the
     server log (no audit-table structure changes, per the brief). */
  console.log(`[projects] audit: project ${params.id} deleted by admin ${session.sub} at ${new Date().toISOString()}`);
  return json({ ok: true });
}
