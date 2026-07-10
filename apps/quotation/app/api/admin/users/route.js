'use strict';

/* Users administration: lists shared platform_users with their
   quotation-app role; PATCH assigns a role. Platform-admin only —
   role assignment is a security-sensitive operation.               */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { ROLES } = require('@/lib/perms');

export async function GET(req) {
  const { session, response } = requireSession(req, { adminOnly: true });
  if (!session) return response;
  const sb = getDb();
  const { data: users, error } = await sb.from('platform_users')
    .select('id, email, full_name, role, created_at').order('created_at');
  if (error) return json({ error: error.message }, 500);
  const { data: roles } = await sb.from('qt_user_roles').select('user_id, role');
  const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));
  return json({
    rows: (users || []).map(u => ({
      ...u,
      qrole: u.role === 'admin' ? 'admin' : (roleMap.get(u.id) || 'readonly'),
      platform_admin: u.role === 'admin',
    })),
  });
}

export async function PATCH(req) {
  const { session, response } = requireSession(req, { adminOnly: true });
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  if (!body.user_id || !ROLES.includes(body.role)) return json({ error: 'user_id and a valid role are required.' }, 400);
  const { error } = await sb.from('qt_user_roles')
    .upsert({ user_id: body.user_id, role: body.role, updated_by: session.sub, updated_at: new Date().toISOString() });
  if (error) return json({ error: error.message }, 500);
  await audit(sb, 'qt_user_roles', body.user_id, 'update', null, { role: body.role }, session.sub);
  return json({ ok: true });
}
