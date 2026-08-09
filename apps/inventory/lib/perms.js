'use strict';

/* Inventory-app roles. Identity lives in the shared platform_users table;
   the inventory-specific role lives in inv_user_roles. A platform 'admin'
   is always an inventory admin. Everyone else defaults to 'readonly'. */

const ROLES = ['admin', 'manager', 'warehouse', 'purchasing', 'readonly'];

const PERMS = {
  admin:      ['write', 'approve', 'reports', 'admin'],
  manager:    ['write', 'approve', 'reports'],
  warehouse:  ['write', 'reports'],
  purchasing: ['write', 'reports'],
  readonly:   [],
};

const WRITE_ROLES = ROLES.filter(r => PERMS[r].includes('write'));

async function getInvRole(sb, session) {
  if (!session) return 'readonly';
  if (session.role === 'admin') return 'admin';
  try {
    const { data } = await sb.from('inv_user_roles').select('role').eq('user_id', session.sub).maybeSingle();
    return (data && data.role) || 'readonly';
  } catch (_) { return 'readonly'; }
}

function can(invrole, perm) { return (PERMS[invrole] || []).includes(perm); }

module.exports = { ROLES, PERMS, WRITE_ROLES, getInvRole, can };
