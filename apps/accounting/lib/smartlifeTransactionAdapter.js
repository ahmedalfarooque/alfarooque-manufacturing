'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   SmartERP TRANSACTION ADAPTER — Daily Move / Receipts / Cash Receipts
   ═══════════════════════════════════════════════════════════════════════

   REAL DATA. Source: SmartERP's own general ledger, synchronized locally by
   apps/shared/journalEntries.js from accounting/get_entry/{id} — an
   already-authorized V3 read endpoint. Nothing here is derived from invoice
   totals, inferred, or fabricated: every row is one real journal line that
   SmartERP itself recorded, and every amount is the value SmartERP reported
   on that line.

   Verified SmartERP entry types (real values in this company's ledger):
     sales, purchases, return_sales, return_purchases, receipt,
     catch_receipt, manual, stock_supply_orders, stock_exchange_orders
   'catch_receipt' is SmartERP's own key for a CASH receipt — hence the
   distinct Receipts vs Cash Receipts reports below, matching how SmartLife
   itself separates them.

   Reads only the local synchronized tables (never SmartERP live on a page
   load), so a report renders from cached data at query speed and a missing
   sync never blocks the page.

   Accounting note on the Receipts / Cash Receipts counterparty columns: a
   receipt entry is a two-sided journal record (one debit line, one credit
   line). Rather than guess which side is "the customer" from an account
   number prefix — a guess that would silently mislabel real money — both
   sides are reported exactly as SmartERP records them: the debit account
   and the credit account, each with its real account number and name. */

const DEBIT = 'debit';
const CREDIT = 'credit';

const ENTRY_TYPE_LABELS = {
  sales: 'Sales',
  purchases: 'Purchase',
  return_sales: 'Sales Return',
  return_purchases: 'Purchase Return',
  receipt: 'Receipt',
  catch_receipt: 'Cash Receipt',
  manual: 'Manual Journal',
  open_dailymove: 'Opening Entry',
  stock_supply_orders: 'Stock Supply Order',
  stock_exchange_orders: 'Stock Exchange Order',
  transfers: 'Transfer',
};

function typeLabel(entryType) {
  return ENTRY_TYPE_LABELS[entryType] || (entryType ? String(entryType) : '—');
}

function r2(value) { return Math.round((Number(value) || 0) * 100) / 100; }

function availableResult(records, totals, extra = {}) {
  return { available: true, statusLabel: 'SmartERP connected', records, totals, ...extra };
}

/* Shared entry+line query. Date filtering is applied on the entry's own
   SmartERP date; branch filtering on the entry's real branch_id. Both are
   real, indexed columns — no client-side scanning. */
/* PostgREST caps any single response at its max-rows setting (1000 here —
   confirmed live: a 2000-row request came back with exactly 1000 entries),
   so a naive .limit() silently truncates and would present a PARTIAL total
   as if it were complete. Entries are therefore paged explicitly, and when
   the requested ceiling is actually hit the caller is told so it can say
   so in the UI rather than quietly under-reporting money. */
const PAGE_SIZE = 1000;
const DEFAULT_ENTRY_LIMIT = 2000;
const MAX_ENTRY_LIMIT = 20000;

async function loadEntries(sb, { from, to, branchId, types, limit } = {}) {
  const ceiling = Math.min(MAX_ENTRY_LIMIT, Math.max(1, Number(limit) || DEFAULT_ENTRY_LIMIT));
  const buildQuery = () => {
    let query = sb.from('erp_smartlife_journal_entries')
      .select('entry_id, entry_number, entry_date, entry_datetime, entry_type, description, reference_number, branch_id, branch_name, fiscal_year, related_id')
      .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife')
      .order('entry_date', { ascending: false })
      .order('entry_id', { ascending: false });
    if (Array.isArray(types) && types.length) query = query.in('entry_type', types);
    if (from) query = query.gte('entry_date', from);
    if (to) query = query.lte('entry_date', to);
    if (branchId) query = query.eq('branch_id', String(branchId));
    return query;
  };

  const entries = [];
  let truncated = false;
  for (let offset = 0; offset < ceiling; offset += PAGE_SIZE) {
    const size = Math.min(PAGE_SIZE, ceiling - offset);
    const { data, error } = await buildQuery().range(offset, offset + size - 1);
    /* An offset past the end of the result set is a normal end-of-data
       condition in PostgREST, not a failure. */
    if (error) {
      if (error.code === 'PGRST103' || /range not satisfiable/i.test(error.message || '')) break;
      throw error;
    }
    if (!data || !data.length) break;
    entries.push(...data);
    if (data.length < size) break;
    if (entries.length >= ceiling) {
      /* Exactly at the ceiling — check whether even one more row exists, so
         "truncated" is a fact rather than an assumption. */
      const probe = await buildQuery().range(ceiling, ceiling);
      truncated = !probe.error && Array.isArray(probe.data) && probe.data.length > 0;
      break;
    }
  }
  if (!entries.length) return { entries: [], linesByEntry: new Map(), truncated: false, ceiling };

  const ids = entries.map(e => e.entry_id);
  const linesByEntry = new Map();
  /* Lines are paged too: one chunk of entry ids can easily hold more lines
     than PostgREST's per-response cap (a single entry can carry many
     lines), and a dropped line would silently change a report total. */
  const ID_CHUNK = 200;
  for (let offset = 0; offset < ids.length; offset += ID_CHUNK) {
    const chunk = ids.slice(offset, offset + ID_CHUNK);
    const lines = [];
    for (let page = 0; ; page += 1) {
      const { data, error: lineError } = await sb.from('erp_smartlife_journal_lines')
        .select('entry_id, line_index, side, value, account_id, account_number, account_name, cost_center_id, cost_center_name, cost_center_number, statement')
        .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife')
        .in('entry_id', chunk)
        .order('entry_id', { ascending: true })
        .order('line_index', { ascending: true })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (lineError) {
        if (lineError.code === 'PGRST103' || /range not satisfiable/i.test(lineError.message || '')) break;
        throw lineError;
      }
      if (!data || !data.length) break;
      lines.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
    for (const line of lines) {
      if (!linesByEntry.has(line.entry_id)) linesByEntry.set(line.entry_id, []);
      linesByEntry.get(line.entry_id).push(line);
    }
  }
  return { entries, linesByEntry, truncated, ceiling };
}

function timeOf(entry) {
  if (!entry.entry_datetime) return null;
  const match = String(entry.entry_datetime).match(/T(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

/* ── Daily Move ──────────────────────────────────────────────────────────
   A real general-ledger movement report: ONE ROW PER JOURNAL LINE, which is
   what a daily-movement/ledger listing is. Debit and credit are the actual
   posted sides; `amount` is the line value; `balance` is the running
   net (debits − credits) accumulated across the returned rows in report
   order, computed here and documented rather than read from SmartERP
   (SmartERP does not report a running balance on the entry endpoint). */
async function getDailyMove(sb, { from, to, branchId, limit } = {}) {
  const { entries, linesByEntry, truncated, ceiling } = await loadEntries(sb, { from, to, branchId, limit });
  const records = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const entry of entries) {
    for (const line of linesByEntry.get(entry.entry_id) || []) {
      const debit = line.side === DEBIT ? r2(line.value) : null;
      const credit = line.side === CREDIT ? r2(line.value) : null;
      totalDebit += debit || 0;
      totalCredit += credit || 0;
      records.push({
        transaction_id: entry.entry_id,
        date: entry.entry_date,
        time: timeOf(entry),
        reference_number: entry.reference_number,
        document_number: entry.entry_number,
        account_number: line.account_number,
        account_name: line.account_name,
        description: line.statement || entry.description,
        transaction_type: typeLabel(entry.entry_type),
        debit,
        credit,
        amount: r2(line.value),
        balance: null,
        cost_center: line.cost_center_name,
        branch_id: entry.branch_id,
        branch_name: entry.branch_name,
        currency: 'SAR',
      });
    }
  }
  /* Running balance, oldest-to-newest so it reads like a ledger, then
     restored to the newest-first display order. */
  let running = 0;
  for (let i = records.length - 1; i >= 0; i -= 1) {
    running += (records[i].debit || 0) - (records[i].credit || 0);
    records[i].balance = r2(running);
  }
  return availableResult(records, {
    rows: records.length,
    entries: entries.length,
    debit: r2(totalDebit),
    credit: r2(totalCredit),
    net: r2(totalDebit - totalCredit),
  }, {
    formula: 'Net = Total Debit − Total Credit. Running balance accumulates (debit − credit) oldest-first across the rows shown.',
    truncated,
    truncationNote: truncated
      ? `Showing the most recent ${ceiling.toLocaleString()} journal entries only — the totals above cover exactly the rows listed, not the whole ledger. Narrow the date range for a complete period total.`
      : null,
  });
}

/* Receipt-style reports: one row per ENTRY (a receipt is a document, not a
   line), reporting both real posted sides. `amount` is the entry's debit
   total, which for a balanced two-sided receipt equals its credit total —
   asserted rather than assumed: the credit total is reported separately so
   any imbalance is visible instead of hidden. */
function receiptRows(entries, linesByEntry) {
  return entries.map(entry => {
    const lines = linesByEntry.get(entry.entry_id) || [];
    const debits = lines.filter(l => l.side === DEBIT);
    const credits = lines.filter(l => l.side === CREDIT);
    const debitTotal = debits.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
    const creditTotal = credits.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
    return {
      receipt_id: entry.entry_id,
      receipt_number: entry.entry_number,
      reference: entry.reference_number,
      date: entry.entry_date,
      time: timeOf(entry),
      debit_account_number: debits[0]?.account_number || null,
      debit_account: debits.map(l => l.account_name).filter(Boolean).join(' / ') || null,
      credit_account_number: credits[0]?.account_number || null,
      credit_account: credits.map(l => l.account_name).filter(Boolean).join(' / ') || null,
      description: entry.description || debits[0]?.statement || credits[0]?.statement || null,
      cost_center: lines.map(l => l.cost_center_name).filter(Boolean)[0] || null,
      amount: r2(debitTotal),
      credit_total: r2(creditTotal),
      branch_id: entry.branch_id,
      branch: entry.branch_name,
      currency: 'SAR',
      status: entry.fiscal_year ? `FY ${entry.fiscal_year}` : null,
    };
  });
}

function receiptTotals(rows) {
  const amount = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  return { rows: rows.length, amount: r2(amount) };
}

/* ── Receipts ── SmartERP entry type 'receipt'. */
async function getReceipts(sb, { from, to, branchId, limit } = {}) {
  const { entries, linesByEntry, truncated, ceiling } = await loadEntries(sb, { from, to, branchId, limit, types: ['receipt'] });
  const rows = receiptRows(entries, linesByEntry);
  return availableResult(rows, receiptTotals(rows), {
    formula: 'Amount = sum of the entry\'s debit lines, as posted by SmartERP. Credit total is shown separately so an unbalanced entry is visible.',
    truncated,
    truncationNote: truncated ? truncationNote(ceiling, 'receipts') : null,
  });
}

/* ── Cash Receipts ── SmartERP entry type 'catch_receipt' (its own key for a
   cash receipt). Kept separate from Receipts because SmartLife itself
   treats them as distinct documents. */
async function getCashReceipts(sb, { from, to, branchId, limit } = {}) {
  const { entries, linesByEntry, truncated, ceiling } = await loadEntries(sb, { from, to, branchId, limit, types: ['catch_receipt'] });
  const rows = receiptRows(entries, linesByEntry);
  return availableResult(rows, receiptTotals(rows), {
    formula: 'Amount = sum of the entry\'s debit lines, as posted by SmartERP. Credit total is shown separately so an unbalanced entry is visible.',
    truncated,
    truncationNote: truncated ? truncationNote(ceiling, 'cash receipts') : null,
  });
}

function truncationNote(ceiling, noun) {
  return `Showing the most recent ${ceiling.toLocaleString()} ${noun} only — the total above covers exactly the rows listed, not the whole ledger. Narrow the date range for a complete period total.`;
}

/* Real branch options for the report filters — distinct branches actually
   present in the synchronized ledger, never a hardcoded list. */
async function getLedgerBranches(sb) {
  const { data, error } = await sb.from('erp_smartlife_journal_entries')
    .select('branch_id, branch_name')
    .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife')
    .not('branch_id', 'is', null)
    .limit(5000);
  if (error) throw error;
  const seen = new Map();
  for (const row of data || []) if (!seen.has(row.branch_id)) seen.set(row.branch_id, row.branch_name);
  return [...seen.entries()].map(([id, name]) => ({ id, name: name || id }));
}

module.exports = {
  getDailyMove, getReceipts, getCashReceipts, getLedgerBranches,
  ENTRY_TYPE_LABELS,
};
