'use strict';

/* COUNT-only availability probe for the ledger-backed reports, used by the
   Financial Reports hub. Deliberately does NOT load report rows: the hub
   only needs to know whether the synchronized SmartERP ledger holds records
   of a given entry type, and a hub page load must stay cheap.

   `entryType === null` means "any entry" (Daily Move covers the whole
   ledger). Availability is derived from the real row count — never
   hardcoded, so a company/period with genuinely no such documents reports
   honestly instead of showing an empty table as if it were broken. */

const LABELS = {
  null: { name: 'ledger movement', report: 'Daily Move' },
  receipt: { name: 'receipt document', report: 'Receipts' },
  catch_receipt: { name: 'cash-receipt document', report: 'Cash Receipts' },
};

async function ledgerReportSummary(sb, entryType) {
  const label = LABELS[String(entryType)] || LABELS.null;
  try {
    let query = sb.from('erp_smartlife_journal_entries')
      .select('entry_id', { count: 'exact', head: true })
      .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife');
    if (entryType) query = query.eq('entry_type', entryType);
    const { count, error } = await query;
    if (error) throw error;
    const total = count || 0;
    if (!total) {
      return {
        available: false,
        statusLabel: 'Awaiting ledger sync',
        description: `No ${label.name}s are present in the synchronized SmartERP ledger yet — run a SmartLife synchronization.`,
        count: 0,
      };
    }
    return {
      available: true,
      statusLabel: 'SmartERP connected',
      description: `${total.toLocaleString()} real ${label.name}(s) from the synchronized SmartERP general ledger.`,
      count: total,
    };
  } catch (_) {
    return {
      available: false,
      statusLabel: 'Ledger unavailable',
      description: 'The synchronized SmartERP ledger could not be read.',
      count: 0,
    };
  }
}

module.exports = { ledgerReportSummary };
