'use strict';

/* Shared helpers for the Orders/Quotes module inside apps/projects
   (ProTrack). This app and the main static site's admin dashboard read
   and write the exact SAME public.orders / public.quotes /
   public.quote_replies tables (same Supabase project, confirmed via
   SUPABASE_URL in both .env.local files) — that shared table is the
   single source of truth; a change from either app is visible in the
   other immediately, with no sync step needed.

   The APPLICATION CODE here is necessarily a separate implementation
   from the main site's api/_ordersCore.js / api/_quotesCore.js /
   api/_softDeleteUtils.js — this is a different, independently
   deployed Next.js app with its own auth (platform_users, not
   admin_users), so those CommonJS files can't be imported directly
   across that boundary. This file mirrors their exact RULES (status
   values, 30-day recovery window, soft-delete column names) so behavior
   stays identical even though the source is duplicated by necessity. */

const RECOVERY_WINDOW_DAYS = 30;

const ORDER_STATUSES = [
  'pending', 'confirmed', 'processing', 'manufacturing', 'quality_check', 'packed',
  'ready', 'shipped', 'out_for_delivery', 'delivered', 'completed', 'cancelled', 'returned', 'rejected',
];
const ORDER_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
const QUOTE_STATUSES = ['new', 'contacted', 'quoted', 'converted', 'closed'];

/* Only one email is treated as Super Admin in this app (see
   lib/superAdmin.js) — mirrors the website admin's "only the highest
   role tier can permanently delete" rule, applied to this app's own
   identity system rather than admin_users.role. */
const { isSuperAdminEmail } = require('./superAdmin');
function isSuperAdmin(session) {
  return !!session && (session.role === 'admin') && isSuperAdminEmail(session.email);
}

/* ── Schema detection (same probe-and-cache pattern as the website
   admin's hasSoftDelete) — lets this module keep working against a
   database where the soft-delete migration hasn't been applied yet,
   instead of throwing a raw Postgres error. ── */
const _cache = { orders: { checkedAt: 0, available: false }, quotes: { checkedAt: 0, available: false } };
const CACHE_TTL_MS = 15000;

async function hasSoftDelete(sb, table) {
  const now = Date.now();
  const c = _cache[table];
  if (now - c.checkedAt < CACHE_TTL_MS) return c.available;
  const { error } = await sb.from(table).select('is_deleted').limit(1);
  c.available = !error;
  c.checkedAt = now;
  return c.available;
}

function isMigrationError(error) {
  if (!error || !error.message) return false;
  const msg = error.message.toLowerCase();
  if (!msg.includes('does not exist') && !msg.includes('could not find')) return false;
  return ['is_deleted', 'deleted_at', 'deleted_by', 'recovered_at', 'recovered_by', 'auto_delete_at']
    .some(col => msg.includes(col));
}
function errorMessage(error, label) {
  if (isMigrationError(error)) {
    return label + ' soft-delete migration has not been applied to the database yet.';
  }
  return error.message;
}

/* Every API route's error branches funnel through this instead of
   calling errorMessage() directly — same convention as
   apps/projects/app/api/quotation-requests/*.js
   (`console.error('[context] action failed:', error.message)`), so a
   genuine Postgres error is never silently swallowed even though the
   client only ever sees the friendly message from errorMessage(). */
function logError(context, error, label) {
  console.error('[' + context + '] failed:', error.message);
  return errorMessage(error, label);
}

function daysRemaining(row) {
  if (!row.auto_delete_at) return RECOVERY_WINDOW_DAYS;
  const msLeft = new Date(row.auto_delete_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}

/* deleted_by/recovered_by can be either an admin_users.id (deleted from
   the Website Admin) or a platform_users.id (deleted from this app) —
   the FK constraint was intentionally dropped (see
   supabase/schema-orders-quotes-shared-ids.sql) so both are valid.
   Resolve a display name by checking both tables. */
async function attachActorNames(sb, rows, idField, nameField) {
  const ids = Array.from(new Set(rows.filter(r => r[idField]).map(r => r[idField])));
  if (!ids.length) return rows;
  const [{ data: admins }, { data: platformUsers }] = await Promise.all([
    sb.from('admin_users').select('id, full_name, email').in('id', ids),
    sb.from('platform_users').select('id, full_name, email').in('id', ids),
  ]);
  const map = {};
  (admins || []).forEach(a => { map[a.id] = a.full_name || a.email; });
  (platformUsers || []).forEach(u => { if (!map[u.id]) map[u.id] = u.full_name || u.email; });
  return rows.map(r => Object.assign({}, r, { [nameField]: r[idField] ? (map[r[idField]] || 'Unknown') : '' }));
}

/* Registered-customer name/email for orders placed by a signed-in
   customer on the public site (guest orders already carry
   guest_name/guest_email on the row itself) — same join shape as the
   website admin's attachCustomerInfo. */
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

module.exports = {
  RECOVERY_WINDOW_DAYS, ORDER_STATUSES, ORDER_PAYMENT_STATUSES, QUOTE_STATUSES,
  isSuperAdmin, hasSoftDelete, errorMessage, logError, daysRemaining,
  attachActorNames, attachCustomerInfo,
};
