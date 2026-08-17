'use strict';

const { APPS, ROLES, modulesFor, defaultPermission, levelToActions, moduleFromPath } = require('./permissionRegistry');

function userIdOf(session) { return session?.sub || session?.id || null; }

async function getEffectivePermission(sb, session, appId, moduleId) {
  if (!session || !APPS.includes(appId) || !moduleId) return { allowed: false, permission: null, reason: 'forbidden' };
  if (session.role === 'admin') return { allowed: true, role: 'admin', permission: defaultPermission('admin', appId, moduleId), admin: true };
  const userId = userIdOf(session);
  if (!userId) return { allowed: false, permission: null, reason: 'forbidden' };

  const [{ data: user }, { data: grant }] = await Promise.all([
    sb.from('platform_users').select('is_active,is_approved').eq('id', userId).maybeSingle(),
    sb.from('app_permissions').select('app_role,module_access').eq('user_id', userId).eq('app_id', appId).maybeSingle(),
  ]);
  if (!user?.is_active || !user?.is_approved || !grant) return { allowed: false, permission: null, reason: 'app_access_required' };

  const role = ROLES.includes(grant.app_role) ? grant.app_role : 'readonly';
  const override = grant.module_access && grant.module_access[moduleId];
  if (override) {
    const permission = typeof override === 'string' ? { ...levelToActions(override), miscellaneous: {} } : override;
    return { allowed: !!permission.view, role, permission, source: 'user_override' };
  }

  const { data: saved } = await sb.from('erp_role_permissions')
    .select('can_view,can_add,can_edit,can_delete,miscellaneous')
    .eq('app_id', appId).eq('role', role).eq('module_id', moduleId).maybeSingle();
  const permission = saved ? {
    view: !!saved.can_view, add: !!saved.can_add, edit: !!saved.can_edit,
    delete: !!saved.can_delete, miscellaneous: saved.miscellaneous || {},
  } : defaultPermission(role, appId, moduleId);
  return { allowed: !!permission.view, role, permission, source: saved ? 'saved_role' : 'role_default' };
}

async function authorizeAction(sb, session, appId, moduleId, action) {
  const effective = await getEffectivePermission(sb, session, appId, moduleId);
  return { ...effective, allowed: !!effective.permission?.[action] };
}

async function authorizeRequest(sb, session, appId, req, action) {
  const pathname = new URL(req.url).pathname;
  const moduleId = moduleFromPath(appId, pathname);
  if (!moduleId) return { allowed: session?.role === 'admin', moduleId: null, reason: 'module_not_registered' };
  return { ...(await authorizeAction(sb, session, appId, moduleId, action)), moduleId };
}

async function effectiveMatrix(sb, session, appId) {
  const rows = [];
  for (const module of modulesFor(appId)) rows.push({ ...module, ...(await getEffectivePermission(sb, session, appId, module.id)) });
  return rows;
}

module.exports = { userIdOf, getEffectivePermission, authorizeAction, authorizeRequest, effectiveMatrix };
