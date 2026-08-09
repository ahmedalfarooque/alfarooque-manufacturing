'use strict';

const ROLES = ['admin', 'manager', 'sales', 'viewer'];

function getAppRole(platformRole) {
  if (platformRole === 'admin') return 'admin';
  if (platformRole === 'manager') return 'manager';
  if (platformRole === 'sales') return 'sales';
  return 'viewer';
}

module.exports = { ROLES, getAppRole };
