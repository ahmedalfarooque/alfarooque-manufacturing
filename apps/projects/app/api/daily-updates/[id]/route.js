'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, isAssignedOrAdmin } = require('@/lib/http');

const REVIEW_STATUSES = ['Pending', 'Approved', 'Rejected', 'Need Revision', 'Published'];

export async function GET(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data: row, error } = await sb
    .from('pm_daily_updates')
    .select('*, pm_projects(id, project_name), platform_users(full_name, email)')
    .eq('id', params.id)
    .maybeSingle();
  if (error) { console.error('[daily-updates] get failed:', error.message); return json({ error: 'Could not load the daily update.' }, 500); }
  if (!row) return json({ error: 'Daily update not found.' }, 404);

  if (!(await isAssignedOrAdmin(session, row.project_id))) return json({ error: 'You do not have access to this daily update.' }, 403);

  const { data: attachments } = await sb
    .from('pm_daily_update_attachments')
    .select('*')
    .eq('daily_update_id', params.id)
    .order('created_at', { ascending: false });

  return json({
    dailyUpdate: {
      ...row,
      project_name: row.pm_projects?.project_name || null,
      author_name: row.platform_users?.full_name || row.platform_users?.email || null,
      pm_projects: undefined,
      platform_users: undefined,
    },
    attachments: (attachments || []).map(a => ({ ...a, url: `/api/daily-updates/${params.id}/attachments/${a.id}` })),
  });
}

export async function PATCH(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data: existing } = await sb.from('pm_daily_updates').select('project_id, author_id').eq('id', params.id).maybeSingle();
  if (!existing) return json({ error: 'Daily update not found.' }, 404);

  // Admin can edit any update; a non-admin may only edit their own (per spec, "optional").
  if (session.role !== 'admin' && existing.author_id !== session.sub) {
    return json({ error: 'You can only edit your own daily updates.' }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const patch = {};
  ['weather', 'todays_work', 'description', 'issues', 'tomorrow_plan', 'remarks', 'update_date', 'title'].forEach(f => {
    if (body[f] !== undefined) patch[f] = body[f];
  });
  if (body.need_help !== undefined) patch.need_help = !!body.need_help;
  if (body.progress_pct !== undefined) patch.progress_pct = body.progress_pct === '' ? null : Math.max(0, Math.min(100, parseInt(body.progress_pct, 10)));

  // Only an admin reviews/publishes an update — the author can edit their own content fields above, but never self-approve.
  if (body.status !== undefined) {
    if (session.role !== 'admin') return json({ error: 'Only an admin can change the review status.' }, 403);
    if (!REVIEW_STATUSES.includes(body.status)) return json({ error: 'Invalid status.' }, 400);
    patch.status = body.status;
    patch.reviewed_by = session.sub;
    patch.reviewed_at = new Date().toISOString();
  }
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const { data: row, error } = await sb.from('pm_daily_updates').update(patch).eq('id', params.id).select().single();
  if (error) { console.error('[daily-updates] update failed:', error.message); return json({ error: 'Could not update the daily update.' }, 500); }

  await sb.from('pm_project_logs').insert({ project_id: existing.project_id, activity: patch.status ? `Daily Update ${patch.status}` : 'Daily Update Edited' });

  if (patch.status && existing.author_id) {
    const notifType = patch.status === 'Approved' ? 'daily_update_approved' : patch.status === 'Rejected' ? 'daily_update_rejected' : 'daily_update';
    await sb.from('notifications').insert({
      user_id: existing.author_id, type: notifType, project_id: existing.project_id, title: `Daily Update ${patch.status}`,
      link: `/projects/${existing.project_id}?tab=daily-updates`,
    }).catch(() => {});
  }

  return json({ dailyUpdate: row });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data: existing } = await sb.from('pm_daily_updates').select('project_id').eq('id', params.id).maybeSingle();
  if (!existing) return json({ error: 'Daily update not found.' }, 404);

  const { data: attachments } = await sb.from('pm_daily_update_attachments').select('storage_path').eq('daily_update_id', params.id);
  if (attachments && attachments.length) {
    await sb.storage.from('project-documents').remove(attachments.map(a => a.storage_path)).catch(() => {});
  }

  const { error } = await sb.from('pm_daily_updates').delete().eq('id', params.id);
  if (error) { console.error('[daily-updates] delete failed:', error.message); return json({ error: 'Could not delete the daily update.' }, 500); }

  await sb.from('pm_project_logs').insert({ project_id: existing.project_id, activity: 'Daily Update Deleted' });
  return json({ ok: true });
}
