'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data: user } = await sb.from('platform_users').select('full_name, email').eq('id', params.userId).maybeSingle();

  const { error } = await sb
    .from('pm_project_assignees')
    .delete()
    .eq('project_id', params.id)
    .eq('user_id', params.userId);
  if (error) { console.error('[assignees] remove failed:', error.message); return json({ error: 'Could not remove the assigned user.' }, 500); }

  if (user) await sb.from('pm_project_logs').insert({ project_id: params.id, activity: `User Unassigned: ${user.full_name || user.email}` });
  return json({ ok: true });
}
