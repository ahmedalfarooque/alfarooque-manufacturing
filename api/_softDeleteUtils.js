'use strict';

/* Generic soft-delete helpers shared by every soft-deletable resource in
   this admin dashboard (currently Orders and Quotes — see
   api/_ordersCore.js and api/_quotesCore.js). Table-specific wiring
   (which table, which probe column, which error strings to recognize)
   stays in each resource's own *Core.js file; only the logic that's
   identical across resources lives here, so a future soft-deletable
   resource extends this instead of re-copying it.
   Import-only (leading underscore ⇒ not routed by Vercel). */

const RECOVERY_WINDOW_DAYS = 30;

/* One admin_users.role value is treated as Super Admin — the highest
   existing tier (admin|manager|sales|production|support|viewer). */
function isSuperAdmin(admin) {
  return !!admin && admin.role === 'admin';
}

/* Days remaining in the 30-day recovery window, from the stored
   auto_delete_at (set at delete time) rather than recomputed from
   deleted_at on every read. */
function daysRemaining(row) {
  if (!row.auto_delete_at) return RECOVERY_WINDOW_DAYS;
  const msLeft = new Date(row.auto_delete_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));
}

/* Builds a `hasSoftDelete(sb)` prober + `sendError(res, error)` for one
   table's soft-delete columns.

   `hasSoftDelete` runs a real probe query (not information_schema —
   PostgREST doesn't expose it by default) against `table`, cached for
   CACHE_TTL_MS per warm serverless instance so normal traffic doesn't
   re-probe on every call, but a migration applied mid-session is picked
   up within seconds (no redeploy/restart needed to notice it).

   `sendError` recognizes a missing-column error for any of `columns`
   and returns a friendly, actionable 503 instead of leaking the raw
   Postgres message to the admin UI. */
function makeSoftDeleteHelpers(table, probeColumn, columns, featureLabel) {
  let cache = { checkedAt: 0, available: false };
  const CACHE_TTL_MS = 15000;

  async function hasSoftDelete(sb) {
    const now = Date.now();
    if (now - cache.checkedAt < CACHE_TTL_MS) return cache.available;
    const { error } = await sb.from(table).select(probeColumn).limit(1);
    const available = !error;
    cache = { checkedAt: now, available };
    return available;
  }

  function isMigrationError(error) {
    if (!error || !error.message) return false;
    const msg = error.message.toLowerCase();
    if (!msg.includes('does not exist') && !msg.includes('could not find')) return false;
    return columns.some(col => msg.includes(col));
  }

  function sendError(res, error) {
    if (isMigrationError(error)) {
      return res.status(503).json({
        error: featureLabel + ' soft-delete migration has not been applied yet. Run the matching supabase/schema-*.sql file, then reload this page.',
      });
    }
    return res.status(500).json({ error: error.message });
  }

  return { hasSoftDelete, isMigrationError, sendError };
}

/* Shared auto-purge routine for the daily cleanup cron endpoints
   (api/cron/cleanup-deleted-orders.js, cleanup-deleted-quotes.js):
   finds every soft-deleted row whose auto_delete_at has passed and
   really deletes it, logging one audit entry + one admin notification
   for the whole batch. Each cron file stays a thin wrapper (secret
   check + call this + shape the response) instead of re-implementing
   the same find→delete→audit→notify sequence per resource. */
async function purgeExpired(sb, { table, labelColumn, resourceLabel, itemNounSingular, auditAction, notificationType, dashboardLink, logAudit }) {
  const { data: expired, error: findError } = await sb.from(table)
    .select('id, ' + labelColumn).eq('is_deleted', true).lte('auto_delete_at', new Date().toISOString());
  if (findError) return { error: findError };
  if (!expired || !expired.length) return { deleted: 0 };

  const ids = expired.map(r => r.id);
  const { error: delError } = await sb.from(table).delete().in('id', ids);
  if (delError) return { error: delError };

  await logAudit(sb, {
    action: auditAction, entityType: itemNounSingular,
    entityId: ids.join(','), details: { count: ids.length, items: expired.map(r => r[labelColumn]) },
  });
  await sb.from('admin_notifications').insert({
    type: notificationType, title: 'Deleted ' + resourceLabel + ' Auto-Purged',
    body: ids.length + ' ' + itemNounSingular + (ids.length === 1 ? '' : 's') + ' past the 30-day recovery window were permanently removed.',
    link: dashboardLink,
  });

  return { deleted: ids.length };
}

module.exports = { RECOVERY_WINDOW_DAYS, isSuperAdmin, daysRemaining, makeSoftDeleteHelpers, purgeExpired };
