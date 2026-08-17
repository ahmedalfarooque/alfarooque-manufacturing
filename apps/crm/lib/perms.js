'use strict';

const ROLES = ['admin', 'manager', 'sales', 'estimator', 'accountant', 'production', 'readonly'];

function getAppRole(platformRole) {
  if (platformRole === 'admin') return 'admin';
  if (platformRole === 'manager') return 'manager';
  if (platformRole === 'sales') return 'sales';
  if (ROLES.includes(platformRole)) return platformRole;
  return 'readonly';
}

module.exports = { ROLES, getAppRole };
