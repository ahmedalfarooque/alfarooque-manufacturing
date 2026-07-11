'use strict';

/* /api/cron/cleanup-deleted — permanently removes soft-deleted Orders
   AND Quotes once their 30-day recovery window has passed. Merged from
   two separate files (cleanup-deleted-orders.js + cleanup-deleted-quotes.js)
   purely to fit Vercel's Hobby-plan 12-serverless-function cap — each
   resource's purge still goes through the shared purgeExpired() helper
   in api/_softDeleteUtils.js, nothing duplicated.

   NOT wired into vercel.json yet (no "crons" entry added) — per the
   "localhost only, do not deploy" constraint this stays a callable,
   testable endpoint until the feature is reviewed and approved. To
   actually schedule it in production later: add a `crons` entry in
   vercel.json pointing at this path (e.g. daily at 03:00) and set
   CRON_CLEANUP_SECRET in the Vercel project env vars — Vercel Cron
   sends that secret as a Bearer token automatically.

   For local testing: GET/POST this route with header
   `Authorization: Bearer <CRON_CLEANUP_SECRET>` (or no header at all
   if CRON_CLEANUP_SECRET is unset in .env, which is the default for a
   fresh localhost checkout). */

const { getAdminClient } = require('../_supabaseAdmin');
const { logAudit } = require('../_adminAuth');
const { sendOrdersError, hasSoftDelete: hasOrdersSoftDelete } = require('../_ordersCore');
const { sendQuotesError, hasSoftDelete: hasQuotesSoftDelete } = require('../_quotesCore');
const { purgeExpired } = require('../_softDeleteUtils');

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_CLEANUP_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== 'Bearer ' + secret) return res.status(401).json({ error: 'Unauthorized.' });
  }

  const sb = getAdminClient();
  const results = { orders: { deleted: 0, skipped: true }, quotes: { deleted: 0, skipped: true } };

  if (await hasOrdersSoftDelete(sb)) {
    const r = await purgeExpired(sb, {
      table: 'orders', labelColumn: 'order_no', resourceLabel: 'Orders', itemNounSingular: 'order',
      auditAction: 'order.auto_purge', notificationType: 'order',
      dashboardLink: '/pages/admin/dashboard.html#orders-deleted', logAudit,
    });
    if (r.error) return sendOrdersError(res, r.error);
    results.orders = { deleted: r.deleted, skipped: false };
  }

  if (await hasQuotesSoftDelete(sb)) {
    const r = await purgeExpired(sb, {
      table: 'quotes', labelColumn: 'email', resourceLabel: 'Quotes', itemNounSingular: 'quote',
      auditAction: 'quote.auto_purge', notificationType: 'quote',
      dashboardLink: '/pages/admin/dashboard.html#quotes-deleted', logAudit,
    });
    if (r.error) return sendQuotesError(res, r.error);
    results.quotes = { deleted: r.deleted, skipped: false };
  }

  return res.status(200).json(results);
};
