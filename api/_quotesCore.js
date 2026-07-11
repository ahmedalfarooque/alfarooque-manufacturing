'use strict';

/* Shared helpers for every /api/admin/quotes* endpoint — mirrors
   api/_ordersCore.js exactly (see that file for the pattern this
   follows). Generic soft-delete plumbing comes from
   api/_softDeleteUtils.js; only Quotes-specific bits (allowed statuses,
   deleted-by name join) live here.
   Import-only (leading underscore ⇒ not routed by Vercel). */

const { RECOVERY_WINDOW_DAYS, isSuperAdmin, daysRemaining, makeSoftDeleteHelpers } = require('./_softDeleteUtils');

const ALLOWED_STATUSES = ['new', 'contacted', 'quoted', 'converted', 'closed'];

const QUOTES_SOFT_DELETE_COLUMNS = ['is_deleted', 'deleted_at', 'deleted_by', 'recovered_at', 'recovered_by', 'auto_delete_at', 'permanently_deleted'];
const { hasSoftDelete, isMigrationError, sendError: sendQuotesError } =
  makeSoftDeleteHelpers('quotes', 'is_deleted', QUOTES_SOFT_DELETE_COLUMNS, 'Quotes');

/* quote_replies is a brand-new table (not just new columns on an
   existing one) — a missing migration shows up as "relation ... does
   not exist" rather than a column error, so it needs its own detector
   sharing the same friendly-message shape as sendQuotesError. */
function isRepliesTableMissing(error) {
  if (!error || !error.message) return false;
  const msg = error.message.toLowerCase();
  return (msg.includes('does not exist') || msg.includes('could not find')) && msg.includes('quote_replies');
}
function sendRepliesError(res, error) {
  if (isRepliesTableMissing(error)) {
    return res.status(503).json({
      error: 'Quote reply history has not been enabled yet. Run supabase/schema-quotes-soft-delete.sql against the database, then reload this page.',
    });
  }
  return res.status(500).json({ error: error.message });
}

/* Attach the deleted_by admin's name/email for the Deleted Quotes table. */
async function attachDeletedByInfo(sb, quotes) {
  const ids = Array.from(new Set(quotes.filter(q => q.deleted_by).map(q => q.deleted_by)));
  if (!ids.length) return quotes;
  const { data: admins } = await sb.from('admin_users').select('id, full_name, email').in('id', ids);
  const map = {};
  (admins || []).forEach(a => { map[a.id] = a.full_name || a.email; });
  return quotes.map(q => Object.assign({}, q, { deleted_by_name: q.deleted_by ? (map[q.deleted_by] || 'Unknown') : '' }));
}

module.exports = {
  RECOVERY_WINDOW_DAYS, ALLOWED_STATUSES,
  isSuperAdmin, isMigrationError, sendQuotesError, hasSoftDelete,
  isRepliesTableMissing, sendRepliesError,
  attachDeletedByInfo, daysRemaining,
};
