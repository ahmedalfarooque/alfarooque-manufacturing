'use strict';

const ERP_APPS = Object.freeze(['quotation', 'projects', 'cars', 'inventory', 'accounting', 'crm']);

function userIdOf(session) {
  return session?.sub || session?.id || null;
}

async function getDeleteAuthorization(sb, session, appId) {
  if (!session || !ERP_APPS.includes(appId)) return { allowed: false, reason: 'forbidden' };
  if (session.role === 'admin') return { allowed: true, admin: true };

  const userId = userIdOf(session);
  if (!userId) return { allowed: false, reason: 'forbidden' };

  const { data: user, error: userError } = await sb.from('platform_users')
    .select('id,is_active,is_approved,role').eq('id', userId).maybeSingle();
  if (userError || !user || !user.is_active || !user.is_approved) {
    return { allowed: false, reason: 'not_approved' };
  }
  if (user.role === 'admin') return { allowed: true, admin: true };

  const { data: grant, error: grantError } = await sb.from('app_permissions')
    .select('can_delete').eq('user_id', userId).eq('app_id', appId).maybeSingle();
  if (grantError || !grant?.can_delete) return { allowed: false, reason: 'missing_delete_permission' };
  return { allowed: true, admin: false };
}

module.exports = { ERP_APPS, userIdOf, getDeleteAuthorization };
