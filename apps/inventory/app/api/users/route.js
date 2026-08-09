'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can, ROLES } = require('@/lib/perms');

export async function GET(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'admin')) return json({ error: 'Admin access required.' }, 403);

  const { data: users } = await sb.from('platform_users')
    .select('id, full_name, email, role, is_active, last_login_at')
    .order('full_name', { ascending: true });
  const { data: invRoles } = await sb.from('inv_user_roles').select('user_id, role');

  const roleMap = {};
  for (const r of invRoles || []) roleMap[r.user_id] = r.role;

  const result = (users || []).map(u => ({
    ...u,
    inv_role: u.role === 'admin' ? 'admin' : (roleMap[u.id] || 'readonly'),
  }));

  return json({ users: result });
}

export async function PUT(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'admin')) return json({ error: 'Admin access required.' }, 403);

  const body = await req.json().catch(() => ({}));
  if (!body.user_id || !body.inv_role) return json({ error: 'user_id and inv_role are required.' }, 400);
  if (!ROLES.includes(body.inv_role)) return json({ error: 'Invalid role.' }, 400);

  const { data: existing } = await sb.from('inv_user_roles').select('id').eq('user_id', body.user_id).maybeSingle();
  if (existing) {
    await sb.from('inv_user_roles').update({ role: body.inv_role }).eq('user_id', body.user_id);
  } else {
    await sb.from('inv_user_roles').insert({ user_id: body.user_id, role: body.inv_role });
  }
  return json({ ok: true });
}
