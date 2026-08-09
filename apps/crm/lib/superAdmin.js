'use strict';

const SUPER_ADMIN_EMAIL = 'arshad@alfarooque.com';

function isSuperAdminEmail(email) {
  return String(email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

module.exports = { SUPER_ADMIN_EMAIL, isSuperAdminEmail };
