'use strict';

/* One master administrator with unrestricted access across the whole
   app, regardless of whatever role is stored in platform_users —
   enforced once here (readSession, see lib/auth.js) rather than at
   every individual permission check. Mirrored across every app
   (projects/quotation/inventory/accounting/crm) — this one was missing
   from cars, meaning the super-admin account did not get automatic
   admin rights here the way it does everywhere else. */

const SUPER_ADMIN_EMAIL = 'arshad@alfarooque.com';

function isSuperAdminEmail(email) {
  return String(email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

module.exports = { SUPER_ADMIN_EMAIL, isSuperAdminEmail };
