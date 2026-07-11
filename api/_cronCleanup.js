'use strict';

/* Permanently removes soft-deleted Orders AND Quotes once their 30-day
   recovery window has passed. Each resource's purge goes through the
   shared purgeExpired() helper in api/_softDeleteUtils.js — nothing
   duplicated between them.

   NOT exposed as a live /api route on purpose: this repo's Vercel
   Hobby-plan deployment was already sitting at exactly the 12-function
   cap before this feature existed, with zero spare slots. Import-only
   (leading underscore ⇒ Vercel/the local dev server never route it),
   so adding this cleanup logic doesn't cost a function slot.

   To actually run it:
   - Locally, call it directly from a one-off script:
       node -e "require('./api/_cronCleanup')({headers:{}}, {status(n){this._s=n;return this}, json(d){console.log(this._s,d)}})"
   - In production, once either a function slot is freed elsewhere or
     the plan is upgraded off Hobby: create a real routed file (e.g.
     api/cron/cleanup-deleted.js) that just does
     `module.exports = require('../_cronCleanup');`, add a `crons` entry
     in vercel.json pointing at it, and set CRON_CLEANUP_SECRET in the
     Vercel project env vars (Vercel Cron sends that secret as a Bearer
     token automatically — the auth check below already expects it). */

const { getAdminClient } = require('./_supabaseAdmin');
const { logAudit } = require('./_adminAuth');
const { sendOrdersError, hasSoftDelete: hasOrdersSoftDelete } = require('./_ordersCore');
const { sendQuotesError, hasSoftDelete: hasQuotesSoftDelete } = require('./_quotesCore');
const { purgeExpired } = require('./_softDeleteUtils');

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
