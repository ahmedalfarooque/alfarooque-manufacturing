'use strict';

/* Permanently removes soft-deleted orders once their 30-day recovery
   window has passed: DELETE WHERE is_deleted = true AND auto_delete_at
   <= now(). auto_delete_at is stamped at delete time (see
   api/admin/orders/delete.js) — a single indexed comparison, no
   recomputation from deleted_at needed here. The actual find→delete→
   audit→notify sequence is shared with api/cron/cleanup-deleted-quotes.js
   via purgeExpired() in api/_softDeleteUtils.js.

   NOT wired into vercel.json yet (no "crons" entry added) — per the
   "localhost only, do not deploy" constraint this stays a callable,
   testable-on-localhost endpoint until the feature is reviewed and
   approved. To actually schedule it in production later: add a
   `crons` entry in vercel.json pointing at this path (e.g. daily at
   03:00) and set CRON_CLEANUP_SECRET in the Vercel project env vars —
   Vercel Cron sends that secret as a Bearer token automatically.

   For local testing: GET/POST this route with header
   `Authorization: Bearer <CRON_CLEANUP_SECRET>` (or no header at all
   if CRON_CLEANUP_SECRET is unset in .env, which is the default for a
   fresh localhost checkout). */

const { getAdminClient } = require('../_supabaseAdmin');
const { logAudit } = require('../_adminAuth');
const { sendOrdersError, hasSoftDelete } = require('../_ordersCore');
const { purgeExpired } = require('../_softDeleteUtils');

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_CLEANUP_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== 'Bearer ' + secret) return res.status(401).json({ error: 'Unauthorized.' });
  }

  const sb = getAdminClient();

  /* Nothing to purge until the migration exists — skip silently rather
     than erroring, since this runs unattended on a schedule. */
  if (!(await hasSoftDelete(sb))) return res.status(200).json({ deleted: 0, skipped: true, reason: 'Soft Delete feature has not been enabled yet.' });

  const result = await purgeExpired(sb, {
    table: 'orders', labelColumn: 'order_no', resourceLabel: 'Orders', itemNounSingular: 'order',
    auditAction: 'order.auto_purge', notificationType: 'order',
    dashboardLink: '/pages/admin/dashboard.html#orders-deleted', logAudit,
  });
  if (result.error) return sendOrdersError(res, result.error);
  return res.status(200).json({ deleted: result.deleted });
};
