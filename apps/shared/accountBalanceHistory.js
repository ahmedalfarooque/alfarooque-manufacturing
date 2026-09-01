'use strict';

/* Append-only daily snapshot of account balances (erp_smartlife_account_
   balance_history), fed by the same real sync data already written to
   erp_smartlife_account_balances — no new SmartLife call, no fabricated
   figure. One row per (tenant, source, account, calendar day); re-running
   sync the same day just updates that day's row rather than duplicating.

   This exists to let period-over-period figures (Cash Flow's "Change in
   inventory/receivables/payables/ownership", "Beginning cash") become REAL
   once at least two distinct snapshot_date values exist for an account —
   there is no shortcut before that: a single point-in-time balance is not
   a "change", so callers must keep showing N/A until history accumulates. */

function recordDailySnapshot(sb, records) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = (records || [])
    .map(r => {
      const accountNumber = String(r?.account_number || '').trim();
      if (!accountNumber) return null;
      return {
        tenant_id: 'alfarooque', source_system: 'smartlife',
        account_number: accountNumber, account_name: r?.account_name || null,
        balance: Number(r?.balance) || 0, snapshot_date: today,
      };
    })
    .filter(Boolean);
  if (!rows.length) return Promise.resolve(0);
  return (async () => {
    for (let offset = 0; offset < rows.length; offset += 500) {
      const { error } = await sb.from('erp_smartlife_account_balance_history').upsert(rows.slice(offset, offset + 500), {
        onConflict: 'tenant_id,source_system,account_number,snapshot_date', ignoreDuplicates: false,
      });
      if (error) throw error;
    }
    return rows.length;
  })();
}

/* Earliest and latest distinct snapshot for one account root. Returns null
   for `earliest` when only one day of history exists yet (same day as
   `latest`) — callers must treat that as "not enough history", not as a
   zero change. */
async function earliestAndLatestBalance(sb, accountNumber) {
  const { data, error } = await sb.from('erp_smartlife_account_balance_history')
    .select('balance, snapshot_date')
    .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('account_number', accountNumber)
    .order('snapshot_date', { ascending: true });
  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return { earliest: null, latest: null, distinctDates: 0 };
  const distinctDates = new Set(rows.map(r => r.snapshot_date)).size;
  return {
    earliest: distinctDates >= 2 ? Number(rows[0].balance) : null,
    latest: Number(rows[rows.length - 1].balance),
    earliestDate: distinctDates >= 2 ? rows[0].snapshot_date : null,
    latestDate: rows[rows.length - 1].snapshot_date,
    distinctDates,
  };
}

module.exports = { recordDailySnapshot, earliestAndLatestBalance };
