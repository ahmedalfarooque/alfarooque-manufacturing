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
   as if it were complete. Entries are therefore paged until the WHOLE
   requested period has been read: an accounting report must never show a
   partial total for the range the user asked for. SAFETY_MAX exists only so
   a runaway query can't exhaust memory; it is far above the entire real
   ledger (9,677 entries) and, if a future ledger ever reached it, the
   caller is told rather than silently under-reporting.

   Entries are ordered by entry_seq ASC here — the canonical ledger order —
   because the running balance must accumulate in record order regardless of
   how the user later chooses to sort the display. */
const PAGE_SIZE = 1000;
const SAFETY_MAX = 100000;

async function loadEntries(sb, { from, to, branchId, types } = {}) {
  const buildQuery = () => {
    let query = sb.from('erp_smartlife_journal_entries')
      .select('entry_id, entry_seq, entry_number, entry_date, entry_datetime, entry_type, description, reference_number, branch_id, branch_name, fiscal_year, related_id')
      .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife')
      .order('entry_seq', { ascending: true });
    if (Array.isArray(types) && types.length) query = query.in('entry_type', types);
    if (from) query = query.gte('entry_date', from);
    if (to) query = query.lte('entry_date', to);
    if (branchId) query = query.eq('branch_id', String(branchId));
    return query;
  };

  const entries = [];
  let truncated = false;
  for (let offset = 0; offset < SAFETY_MAX; offset += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(offset, offset + PAGE_SIZE - 1);
    /* An offset past the end of the result set is a normal end-of-data
       condition in PostgREST, not a failure. */
    if (error) {
      if (error.code === 'PGRST103' || /range not satisfiable/i.test(error.message || '')) break;
      throw error;
    }
    if (!data || !data.length) break;
    entries.push(...data);
    if (data.length < PAGE_SIZE) break;
    if (entries.length >= SAFETY_MAX) { truncated = true; break; }
  }
  if (!entries.length) return { entries: [], linesByEntry: new Map(), truncated: false };

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
  return { entries, linesByEntry, truncated };
}

/* ── Sorting ─────────────────────────────────────────────────────────────
   Applied server-side over the COMPLETE period already loaded above, so a
   sort is never limited to "the rows currently on screen". Default is the
   record number ascending, matching SmartLife's own Daily Move default
   (its Record Number column, ascending) rather than date — date-primary
   ordering was explicitly not what the ledger convention uses.

   entry_seq (numeric) backs the record-number sort so '20260000006' orders
   after '2025000331' numerically instead of lexically. */
const SORT_KEYS = {
  entry: { label: 'Entry #', get: row => Number(row.__seq) || 0 },
  reference: { label: 'Reference', get: row => row.reference_number || '' },
  date: { label: 'Date', get: row => `${row.date || ''} ${row.time || ''}` },
  account_number: { label: 'Account #', get: row => row.account_number || row.debit_account_number || '' },
  account_name: { label: 'Account', get: row => row.account_name || row.debit_account || '' },
  type: { label: 'Type', get: row => row.transaction_type || '' },
  debit: { label: 'Debit', get: row => Number(row.debit ?? row.amount) || 0 },
  credit: { label: 'Credit', get: row => Number(row.credit ?? row.credit_total) || 0 },
  amount: { label: 'Amount', get: row => Number(row.amount) || 0 },
};

function sortRows(rows, sortKey, direction) {
  const spec = SORT_KEYS[sortKey] || SORT_KEYS.entry;
  const sign = String(direction).toLowerCase() === 'desc' ? -1 : 1;
  return rows.slice().sort((a, b) => {
    const av = spec.get(a);
    const bv = spec.get(b);
    if (typeof av === 'number' && typeof bv === 'number') {
      if (av !== bv) return (av - bv) * sign;
    } else {
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      if (cmp !== 0) return cmp * sign;
    }
    /* Stable tie-break on the record number so equal keys never reorder
       between two identical requests. */
    return ((Number(a.__seq) || 0) - (Number(b.__seq) || 0)) * sign;
  });
}

/* Drops fields that exist only for server-side ordering/precision so they
   never reach the client, the exports, or the print sheet. */
function stripInternal(rows) {
  return rows.map(({ __seq, amount_raw, ...rest }) => rest);
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
async function getDailyMove(sb, { from, to, branchId, sort, direction } = {}) {
  const { entries, linesByEntry, truncated } = await loadEntries(sb, { from, to, branchId });
  const records = [];
  let totalDebit = 0;
  let totalCredit = 0;
  /* entries arrive in canonical record order (entry_seq ASC), so the
     running balance below is a true ledger balance independent of whatever
     display sort the user picks afterwards. */
  let running = 0;
  for (const entry of entries) {
    for (const line of linesByEntry.get(entry.entry_id) || []) {
      /* Totals and the running balance accumulate the RAW SmartERP line
         value and are rounded only for display. Rounding each line to 2dp
         first drifted the period total by ~0.21 SAR against SmartLife's own
         Daily Move footer (SmartERP stores 4-decimal line values, e.g.
         395.7100), which for an accounting report is a real discrepancy,
         not a cosmetic one. */
      const raw = Number(line.value) || 0;
      const isDebit = line.side === DEBIT;
      const debit = isDebit ? r2(raw) : null;
      const credit = line.side === CREDIT ? r2(raw) : null;
      if (isDebit) totalDebit += raw; else if (line.side === CREDIT) totalCredit += raw;
      running += isDebit ? raw : (line.side === CREDIT ? -raw : 0);
      records.push({
        __seq: entry.entry_seq,
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
        balance: r2(running),
        cost_center: line.cost_center_name,
        branch_id: entry.branch_id,
        branch_name: entry.branch_name,
        currency: 'SAR',
      });
    }
  }
  const sorted = stripInternal(sortRows(records, sort, direction));
  return availableResult(sorted, {
    rows: sorted.length,
    entries: entries.length,
    debit: r2(totalDebit),
    credit: r2(totalCredit),
    net: r2(totalDebit - totalCredit),
  }, {
    formula: 'Net = Total Debit − Total Credit. Running balance accumulates (debit − credit) in record order (Entry # ascending), so it stays a true ledger balance whatever display sort is selected.',
    truncated,
  });
}

/* Receipt-style reports: one row per ENTRY (a receipt is a document, not a
   line), reporting both real posted sides. `amount` is the entry's debit
   total, which for a balanced two-sided receipt equals its credit total —
   asserted rather than assumed: the credit total is reported separately so
   any imbalance is visible instead of hidden. */
function receiptRows(entries, linesByEntry) {
  return entries.map(entry => {
    const __seq = entry.entry_seq;
    const lines = linesByEntry.get(entry.entry_id) || [];
    const debits = lines.filter(l => l.side === DEBIT);
    const credits = lines.filter(l => l.side === CREDIT);
    /* Raw 4-decimal line values summed, rounded once — see the same note in
       getDailyMove: pre-rounding each line drifts the period total. */
    const debitTotal = debits.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
    const creditTotal = credits.reduce((sum, l) => sum + (Number(l.value) || 0), 0);
    return {
      __seq,
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
      amount_raw: debitTotal,
      credit_total: r2(creditTotal),
      branch_id: entry.branch_id,
      branch: entry.branch_name,
      currency: 'SAR',
      status: entry.fiscal_year ? `FY ${entry.fiscal_year}` : null,
    };
  });
}

function receiptTotals(rows) {
  const amount = rows.reduce((sum, r) => sum + (Number(r.amount_raw ?? r.amount) || 0), 0);
  return { rows: rows.length, amount: r2(amount) };
}

/* ── Receipts ── SmartERP entry type 'receipt'. */
async function getReceipts(sb, { from, to, branchId, sort, direction } = {}) {
  const { entries, linesByEntry, truncated } = await loadEntries(sb, { from, to, branchId, types: ['receipt'] });
  const rows = receiptRows(entries, linesByEntry);
  const sorted = sortRows(rows, sort, direction);
  const totals = receiptTotals(sorted);
  return availableResult(stripInternal(sorted), totals, {
    formula: 'Amount = sum of the entry\'s debit lines, as posted by SmartERP. Credit total is shown separately so an unbalanced entry is visible.',
    truncated,
  });
}

/* ── Cash Receipts ── SmartERP entry type 'catch_receipt' (its own key for a
   cash receipt). Kept separate from Receipts because SmartLife itself
   treats them as distinct documents. */
async function getCashReceipts(sb, { from, to, branchId, sort, direction } = {}) {
  const { entries, linesByEntry, truncated } = await loadEntries(sb, { from, to, branchId, types: ['catch_receipt'] });
  const rows = receiptRows(entries, linesByEntry);
  const sorted = sortRows(rows, sort, direction);
  /* Totals BEFORE stripping — they need the raw un-rounded amounts. */
  const totals = receiptTotals(sorted);
  return availableResult(stripInternal(sorted), totals, {
    formula: 'Amount = sum of the entry\'s debit lines, as posted by SmartERP. Credit total is shown separately so an unbalanced entry is visible.',
    truncated,
  });
}

/* One real receipt/cash-receipt document, for the SmartLife-style printable
   voucher. Reads the same synchronized ledger — never a second source. */
async function getReceiptDocument(sb, entryId) {
  const { data: entry, error } = await sb.from('erp_smartlife_journal_entries')
    .select('entry_id, entry_number, entry_date, entry_datetime, entry_type, description, reference_number, branch_id, branch_name, fiscal_year')
    .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('entry_id', String(entryId))
    .maybeSingle();
  if (error) throw error;
  if (!entry) return null;
  const { data: lines, error: lineError } = await sb.from('erp_smartlife_journal_lines')
    .select('line_index, side, value, account_number, account_name, cost_center_name, statement')
    .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('entry_id', String(entryId))
    .order('line_index', { ascending: true });
  if (lineError) throw lineError;
  const map = new Map([[entry.entry_id, lines || []]]);
  const [row] = receiptRows([entry], map);
  const { __seq, ...record } = row;
  return { ...record, entry_type: entry.entry_type, lines: lines || [] };
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
  getDailyMove, getReceipts, getCashReceipts, getReceiptDocument, getLedgerBranches,
  ENTRY_TYPE_LABELS, SORT_KEYS,
};
