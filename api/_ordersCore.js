'use strict';

/* Shared helpers for every /api/admin/orders* endpoint (orders.js,
   orders/deleted.js, orders/delete.js, orders/recover.js,
   orders/permanent.js) — one place for the soft-delete rules so a
   future Orders feature can't accidentally forget to filter is_deleted,
   duplicate the customer-info join, or query the wrong column name.
   The generic soft-delete plumbing (schema probe, migration-aware error,
   days-remaining calc, Super Admin check) lives in api/_softDeleteUtils.js
   and is shared with api/_quotesCore.js — only Orders-specific bits
   (ALLOWED_STATUSES, attachCustomerInfo, attachDeletedByInfo) live here.
   Import-only (leading underscore ⇒ not routed by Vercel). */

const { RECOVERY_WINDOW_DAYS, isSuperAdmin, daysRemaining, makeSoftDeleteHelpers } = require('./_softDeleteUtils');

const ALLOWED_STATUSES = [
  'pending', 'confirmed', 'processing', 'manufacturing', 'quality_check', 'packed',
  'ready', 'shipped', 'out_for_delivery', 'delivered', 'completed', 'cancelled', 'returned', 'rejected',
];
const ALLOWED_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

const ORDERS_SOFT_DELETE_COLUMNS = ['is_deleted', 'deleted_at', 'deleted_by', 'recovered_at', 'recovered_by', 'auto_delete_at', 'permanently_deleted'];
const { hasSoftDelete, isMigrationError, sendError: sendOrdersError } =
  makeSoftDeleteHelpers('orders', 'is_deleted', ORDERS_SOFT_DELETE_COLUMNS, 'Orders');

/* Attach the real name/email for orders placed by a signed-in customer
   (guest orders already carry guest_name/guest_email on the row itself). */
async function attachCustomerInfo(sb, orders) {
  const ids = Array.from(new Set(orders.filter(o => o.user_id).map(o => o.user_id)));
  if (!ids.length) return orders;

  const [{ data: profiles }, { data: usersPage }] = await Promise.all([
    sb.from('profiles').select('id, first_name, last_name, full_name').in('id', ids),
    sb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.id] = p; });
  const emailMap = {};
  (usersPage && usersPage.users || []).forEach(u => { emailMap[u.id] = u.email; });

  return orders.map(o => {
    if (!o.user_id) return o;
    const p = profileMap[o.user_id] || {};
    return Object.assign({}, o, {
      customer_name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || emailMap[o.user_id] || 'Registered customer',
      customer_email: emailMap[o.user_id] || '',
    });
  });
}

/* Attach the deleted_by admin's name/email for the Deleted Orders table. */
async function attachDeletedByInfo(sb, orders) {
  const ids = Array.from(new Set(orders.filter(o => o.deleted_by).map(o => o.deleted_by)));
  if (!ids.length) return orders;
  const { data: admins } = await sb.from('admin_users').select('id, full_name, email').in('id', ids);
  const map = {};
  (admins || []).forEach(a => { map[a.id] = a.full_name || a.email; });
  return orders.map(o => Object.assign({}, o, { deleted_by_name: o.deleted_by ? (map[o.deleted_by] || 'Unknown') : '' }));
}

module.exports = {
  RECOVERY_WINDOW_DAYS, ALLOWED_STATUSES, ALLOWED_PAYMENT_STATUSES,
  isSuperAdmin, isMigrationError, sendOrdersError, hasSoftDelete,
  attachCustomerInfo, attachDeletedByInfo, daysRemaining,
};
