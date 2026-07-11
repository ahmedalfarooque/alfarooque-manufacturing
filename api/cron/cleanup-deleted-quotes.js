'use strict';

/* Permanently removes soft-deleted quotes once their 30-day recovery
   window has passed. Mirrors api/cron/cleanup-deleted-orders.js exactly
   — see that file for the full rationale (not wired into vercel.json,
   local-testing instructions, etc.). Shares the actual purge logic via
   purgeExpired() in api/_softDeleteUtils.js. */

const { getAdminClient } = require('../_supabaseAdmin');
const { logAudit } = require('../_adminAuth');
const { sendQuotesError, hasSoftDelete } = require('../_quotesCore');
const { purgeExpired } = require('../_softDeleteUtils');

module.exports = async function handler(req, res) {
  const secret = process.env.CRON_CLEANUP_SECRET;
  if (secret) {
    const auth = req.headers.authorization || '';
    if (auth !== 'Bearer ' + secret) return res.status(401).json({ error: 'Unauthorized.' });
  }

  const sb = getAdminClient();

  if (!(await hasSoftDelete(sb))) return res.status(200).json({ deleted: 0, skipped: true, reason: 'Soft Delete feature has not been enabled yet.' });

  const result = await purgeExpired(sb, {
    table: 'quotes', labelColumn: 'email', resourceLabel: 'Quotes', itemNounSingular: 'quote',
    auditAction: 'quote.auto_purge', notificationType: 'quote',
    dashboardLink: '/pages/admin/dashboard.html#quotes-deleted', logAudit,
  });
  if (result.error) return sendQuotesError(res, result.error);
  return res.status(200).json({ deleted: result.deleted });
};
