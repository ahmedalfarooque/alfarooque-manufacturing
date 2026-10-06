'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { APPS, ROLES, ACCESS_LEVELS, modulesFor } = require('./permissionRegistry');

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function adminSession(readSession, req) {
  const session = readSession(req);
  if (!session) return { response: json({ error: 'Not authenticated.' }, 401) };
  if (session.role !== 'admin') return { response: json({ error: 'Admin access required.' }, 403) };
  return { session };
}

function temporaryPassword() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

function cleanAccess(access, fallbackApp, fallbackRole) {
  const source = Array.isArray(access) && access.length ? access : [{ app_id: fallbackApp, role: fallbackRole }];
  return source.filter(row => APPS.includes(row.app_id)).map(row => ({
    app_id: row.app_id,
    role: ROLES.includes(row.role) ? row.role : 'readonly',
    module_access: row.module_access && typeof row.module_access === 'object' ? row.module_access : {},
    can_delete: !!row.can_delete,
  }));
}

function createAdminUsersHandlers({ getDb, readSession, appId }) {
  async function GET(req) {
    const gate = adminSession(readSession, req);
    if (gate.response) return gate.response;
    const sb = getDb();
    const [{ data: users, error }, { data: grants }] = await Promise.all([
      sb.from('platform_users').select('id,email,full_name,role,is_active,is_approved,created_at,status,otp_login_enabled').order('created_at', { ascending: false }),
      sb.from('app_permissions').select('user_id,app_id,app_role,module_access,can_delete'),
    ]);
    if (error) return json({ error: error.message }, 500);
    const byUser = new Map();
    for (const grant of grants || []) {
      if (!byUser.has(grant.user_id)) byUser.set(grant.user_id, []);
      byUser.get(grant.user_id).push(grant);
    }
    return json({
      roles: ROLES,
      apps: APPS,
      modules: modulesFor(appId),
      rows: (users || []).map(user => {
        const access = byUser.get(user.id) || [];
        const current = access.find(row => row.app_id === appId);
        return {
          ...user,
          platform_admin: user.role === 'admin',
          app_access: access,
          app_role: user.role === 'admin' ? 'admin' : (current?.app_role || 'readonly'),
          /* false = no app_permissions row for this app: the user cannot
             use it at all until an admin assigns a role (which creates
             the grant). Platform admins always have access. */
          has_app_access: user.role === 'admin' || !!current,
          module_access: current?.module_access || {},
          can_delete: user.role === 'admin' || !!current?.can_delete,
        };
      }),
    });
  }

  async function POST(req) {
    const gate = adminSession(readSession, req);
    if (gate.response) return gate.response;
    const body = await req.json().catch(() => ({}));
    const fullName = String(body.full_name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    if (!fullName) return json({ error: 'Full name is required.' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'A valid email is required.' }, 400);
    const access = cleanAccess(body.app_access, appId, body.role);
    const sb = getDb();
    let { data: user } = await sb.from('platform_users').select('id,email,full_name,role,is_active,is_approved,created_at').eq('email', email).maybeSingle();
    let password = null;
    if (!user) {
      password = temporaryPassword();
      const passwordHash = await bcrypt.hash(password, 10);
      const inserted = await sb.from('platform_users').insert({
        full_name: fullName, email, role: 'viewer', password_hash: passwordHash,
        must_change_password: true, otp_login_enabled: true, is_active: true,
        is_approved: !!body.is_approved, status: 'Active',
      }).select('id,email,full_name,role,is_active,is_approved,created_at').single();
      if (inserted.error) return json({ error: inserted.error.message }, 500);
      user = inserted.data;
    } else if (user.full_name !== fullName) {
      const updated = await sb.from('platform_users').update({ full_name: fullName }).eq('id', user.id).select('id,email,full_name,role,is_active,is_approved,created_at').single();
      if (updated.error) return json({ error: updated.error.message }, 500);
      user = updated.data;
    }
    if (typeof body.is_approved === 'boolean') {
      const approved = await sb.from('platform_users').update({ is_approved: body.is_approved }).eq('id', user.id);
      if (approved.error) return json({ error: approved.error.message }, 500);
    }
    for (const grant of access) {
      const result = await sb.from('app_permissions').upsert({
        user_id: user.id, ...grant, granted_by: gate.session.sub,
      }, { onConflict: 'user_id,app_id' });
      if (result.error) return json({ error: result.error.message }, 500);
    }
    return json({ user, temp_password: password, reused_identity: !password }, password ? 201 : 200);
  }

  async function PATCH(req) {
    const gate = adminSession(readSession, req);
    if (gate.response) return gate.response;
    const body = await req.json().catch(() => ({}));
    if (!body.user_id) return json({ error: 'user_id is required.' }, 400);
    const sb = getDb();
    const userPatch = {};
    if (body.full_name !== undefined) userPatch.full_name = String(body.full_name).trim();
    if (typeof body.is_approved === 'boolean') userPatch.is_approved = body.is_approved;
    if (typeof body.is_active === 'boolean') userPatch.is_active = body.is_active;
    if (Object.keys(userPatch).length) {
      const result = await sb.from('platform_users').update(userPatch).eq('id', body.user_id);
      if (result.error) return json({ error: result.error.message }, 500);
    }
    if (body.app_id) {
      if (!APPS.includes(body.app_id)) return json({ error: 'Unknown application.' }, 400);
      const patch = { user_id: body.user_id, app_id: body.app_id, granted_by: gate.session.sub };
      if (body.role !== undefined) {
        if (!ROLES.includes(body.role)) return json({ error: 'Unknown role.' }, 400);
        patch.app_role = body.role;
      }
      if (body.module_access !== undefined) {
        if (!body.module_access || typeof body.module_access !== 'object' || Array.isArray(body.module_access)) return json({ error: 'module_access must be an object.' }, 400);
        for (const level of Object.values(body.module_access)) if (!ACCESS_LEVELS.includes(level)) return json({ error: 'Unknown module access level.' }, 400);
        patch.module_access = body.module_access;
      }
      if (typeof body.can_delete === 'boolean') patch.can_delete = body.can_delete;
      const result = await sb.from('app_permissions').upsert(patch, { onConflict: 'user_id,app_id' });
      if (result.error) return json({ error: result.error.message }, 500);
    }
    return json({ ok: true });
  }

  async function DELETE(req, { params }) {
    const gate = adminSession(readSession, req);
    if (gate.response) return gate.response;
    if (params.id === gate.session.sub) return json({ error: 'You cannot delete your own account.' }, 400);
    const sb = getDb();
    const { error } = await sb.from('platform_users').delete().eq('id', params.id);
    if (error?.code === '23503') return json({ error: 'This user has related business records. Deactivate the user instead.' }, 409);
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  return { GET, POST, PATCH, DELETE };
}

module.exports = { createAdminUsersHandlers };
