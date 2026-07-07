'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb
    .from('pm_project_assignees')
    .select('project_id, assigned_at, platform_users(id, full_name, email, position, role)')
    .eq('project_id', params.id)
    .order('assigned_at', { ascending: true });
  if (error) { console.error('[assignees] list failed:', error.message); return json({ error: 'Could not load assigned users.' }, 500); }

  const assignees = (data || [])
    .filter(r => r.platform_users)
    .map(r => ({ ...r.platform_users, assigned_at: r.assigned_at }));
  return json({ assignees });
}

export async function POST(req, { params }) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const userId = String(body.user_id || '').trim();
  if (!userId) return json({ error: 'user_id is required.' }, 400);

  const sb = getDb();
  const { data: project } = await sb.from('pm_projects').select('id').eq('id', params.id).maybeSingle();
  if (!project) return json({ error: 'Project not found.' }, 404);

  const { data: user } = await sb.from('platform_users').select('id, full_name, email').eq('id', userId).maybeSingle();
  if (!user) return json({ error: 'User not found.' }, 404);

  const { error } = await sb.from('pm_project_assignees').upsert({
    project_id: params.id, user_id: userId, assigned_by: session.sub,
  }, { onConflict: 'project_id,user_id' });
  if (error) { console.error('[assignees] add failed:', error.message); return json({ error: 'Could not assign the user.' }, 500); }

  await sb.from('pm_project_logs').insert({ project_id: params.id, activity: `User Assigned: ${user.full_name || user.email}` });
  return json({ ok: true }, 201);
}
