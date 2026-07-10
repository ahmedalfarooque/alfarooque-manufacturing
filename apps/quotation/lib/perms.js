'use strict';

/* Quotation-app roles (spec §21). Identity lives in the shared
   platform_users table; the quotation-specific role lives in
   qt_user_roles. A platform 'admin' is always a quotation admin.
   Everyone else defaults to 'readonly' until assigned.              */

const ROLES = ['admin', 'manager', 'sales', 'estimator', 'accountant', 'production', 'readonly'];

const PERMS = {
  admin:      ['write', 'approve', 'costs', 'reports', 'admin'],
  manager:    ['write', 'approve', 'costs', 'reports'],
  sales:      ['write', 'reports'],
  estimator:  ['write', 'costs'],
  accountant: ['reports', 'costs'],
  production: [],
  readonly:   [],
};

const WRITE_ROLES = ROLES.filter(r => PERMS[r].includes('write'));

async function getQRole(sb, session) {
  if (!session) return 'readonly';
  if (session.role === 'admin') return 'admin';
  try {
    const { data } = await sb.from('qt_user_roles').select('role').eq('user_id', session.sub).maybeSingle();
    return (data && data.role) || 'readonly';
  } catch (_) { return 'readonly'; }
}

function can(qrole, perm) { return (PERMS[qrole] || []).includes(perm); }

module.exports = { ROLES, PERMS, WRITE_ROLES, getQRole, can };
