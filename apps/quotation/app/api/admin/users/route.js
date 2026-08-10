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
    .select('id, email, full_name, role, is_active, is_approved, created_at').order('created_at');
  if (error) return json({ error: error.message }, 500);
  const { data: roles } = await sb.from('qt_user_roles').select('user_id, role');
  const { data: grants } = await sb.from('app_permissions').select('user_id,can_delete').eq('app_id', 'quotation');
  const roleMap = new Map((roles || []).map(r => [r.user_id, r.role]));
  const deleteMap = new Map((grants || []).map(r => [r.user_id, !!r.can_delete]));
  return json({
    rows: (users || []).map(u => ({
      ...u,
      qrole: u.role === 'admin' ? 'admin' : (roleMap.get(u.id) || 'readonly'),
      platform_admin: u.role === 'admin',
      can_delete: u.role === 'admin' || deleteMap.get(u.id) || false,
    })),
  });
}

export async function PATCH(req) {
  const { session, response } = requireSession(req, { adminOnly: true });
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  if (!body.user_id) return json({ error: 'user_id is required.' }, 400);
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) return json({ error: 'A valid role is required.' }, 400);
    const { error } = await sb.from('qt_user_roles')
      .upsert({ user_id: body.user_id, role: body.role, updated_by: session.sub, updated_at: new Date().toISOString() });
    if (error) return json({ error: error.message }, 500);
  }
  if (typeof body.is_approved === 'boolean') {
    const { error } = await sb.from('platform_users').update({ is_approved: body.is_approved }).eq('id', body.user_id);
    if (error) return json({ error: error.message }, 500);
  }
  if (typeof body.can_delete === 'boolean') {
    const { error } = await sb.from('app_permissions').upsert({
      user_id: body.user_id, app_id: 'quotation', can_delete: body.can_delete, granted_by: session.sub,
    }, { onConflict: 'user_id,app_id' });
    if (error) return json({ error: error.message }, 500);
  }
  await audit(sb, 'qt_user_roles', body.user_id, 'update', null, {
    role: body.role, is_approved: body.is_approved, can_delete: body.can_delete,
  }, session.sub);
  return json({ ok: true });
}
