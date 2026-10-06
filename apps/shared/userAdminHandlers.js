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

const { diffAppGrants, DEFAULT_GRANT_ROLE } = require('./appAccess');

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
          /* Application access (which apps the user may enter) — one id per
             app_permissions row; platform admins may enter every app. */
          apps: user.role === 'admin' ? [...APPS] : APPS.filter(id => access.some(row => row.app_id === id)),
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
    /* set_apps: the Application Access editor — the full list of apps the
       user may enter. Rows are added/removed by difference so existing
       grants keep their in-app role and module overrides; the unique
       (user_id, app_id) key plus the diff make duplicates impossible. */
    if (body.set_apps !== undefined) {
      if (!Array.isArray(body.set_apps)) return json({ error: 'set_apps must be a list of application ids.' }, 400);
      const { data: target, error: tErr } = await sb.from('platform_users').select('role').eq('id', body.user_id).maybeSingle();
      if (tErr) return json({ error: tErr.message }, 500);
      if (!target) return json({ error: 'User not found.' }, 404);
      if (target.role === 'admin') return json({ error: 'Platform administrators always have access to every application; change their platform role instead.' }, 400);
      const { data: current, error: cErr } = await sb.from('app_permissions').select('app_id').eq('user_id', body.user_id);
      if (cErr) return json({ error: cErr.message }, 500);
      const diff = diffAppGrants((current || []).map(r => r.app_id), body.set_apps);
      if (!diff) return json({ error: 'Unknown application.' }, 400);
      if (body.user_id === gate.session.sub && diff.remove.includes(appId)) return json({ error: 'You cannot revoke your own access.' }, 400);
      for (const app_id of diff.remove) {
        const { error: dErr } = await sb.from('app_permissions').delete().eq('user_id', body.user_id).eq('app_id', app_id);
        if (dErr) return json({ error: dErr.message }, 500);
      }
      for (const app_id of diff.add) {
        const { error: uErr } = await sb.from('app_permissions').upsert({ user_id: body.user_id, app_id, app_role: DEFAULT_GRANT_ROLE, granted_by: gate.session.sub }, { onConflict: 'user_id,app_id' });
        if (uErr) return json({ error: uErr.message }, 500);
      }
      return json({ ok: true, apps: diff.apps, added: diff.add, removed: diff.remove });
    }
    if (body.app_id) {
      if (!APPS.includes(body.app_id)) return json({ error: 'Unknown application.' }, 400);
      /* revoke_app: remove the user's grant for this app entirely (the
         opposite of assigning a role). Platform admins have no per-app
         grant to remove, and nobody can revoke their own access. */
      if (body.revoke_app === true) {
        if (body.user_id === gate.session.sub) return json({ error: 'You cannot revoke your own access.' }, 400);
        const { data: target, error: tErr } = await sb.from('platform_users').select('role').eq('id', body.user_id).maybeSingle();
        if (tErr) return json({ error: tErr.message }, 500);
        if (!target) return json({ error: 'User not found.' }, 404);
        if (target.role === 'admin') return json({ error: 'Platform administrators always have access; change their platform role instead.' }, 400);
        const { error: dErr } = await sb.from('app_permissions').delete().eq('user_id', body.user_id).eq('app_id', body.app_id);
        if (dErr) return json({ error: dErr.message }, 500);
        return json({ ok: true, revoked: body.app_id });
      }
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
