'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   LEDGER REPORT DEFINITIONS — single source of truth
   ═══════════════════════════════════════════════════════════════════════

   Daily Move / Receipts / Cash Receipts share one definition each, consumed
   by every surface: the on-screen table, the PDF export, the Excel export
   and the print layout. That is deliberate — it is the only way "UI = PDF =
   Excel = Print" can be guaranteed rather than hoped for. Adding a column
   here adds it everywhere; nothing downstream keeps its own column list.

   No SmartERP field names are invented: every `key` matches a field the
   adapter (smartlifeTransactionAdapter.js) actually produces from real
   journal data. */

const MONEY = { numeric: true, money: true };

const DAILY_MOVE_COLUMNS = [
  { key: 'date', label: 'Date', width: 12 },
  { key: 'time', label: 'Time', width: 8 },
  { key: 'document_number', label: 'Entry #', width: 15 },
  { key: 'reference_number', label: 'Reference', width: 11 },
  { key: 'transaction_type', label: 'Type', width: 16 },
  { key: 'account_number', label: 'Account #', width: 15 },
  { key: 'account_name', label: 'Account', width: 34, wide: true },
  { key: 'description', label: 'Description', width: 34, wide: true },
  { key: 'cost_center', label: 'Cost Center', width: 16 },
  { key: 'debit', label: 'Debit', width: 14, ...MONEY },
  { key: 'credit', label: 'Credit', width: 14, ...MONEY },
  { key: 'balance', label: 'Balance', width: 15, ...MONEY },
  { key: 'branch_name', label: 'Branch', width: 16 },
];

const RECEIPT_COLUMNS = [
  { key: 'receipt_number', label: 'Receipt #', width: 15 },
  { key: 'reference', label: 'Reference', width: 11 },
  { key: 'date', label: 'Date', width: 12 },
  { key: 'debit_account_number', label: 'Debit A/C #', width: 16 },
  { key: 'debit_account', label: 'Debit Account', width: 34, wide: true },
  { key: 'credit_account_number', label: 'Credit A/C #', width: 16 },
  { key: 'credit_account', label: 'Credit Account', width: 34, wide: true },
  { key: 'description', label: 'Description', width: 34, wide: true },
  { key: 'cost_center', label: 'Cost Center', width: 16 },
  { key: 'amount', label: 'Amount', width: 14, ...MONEY },
  { key: 'currency', label: 'Currency', width: 9 },
  { key: 'branch', label: 'Branch', width: 16 },
  { key: 'status', label: 'Fiscal Year', width: 11 },
];

/* Cash Receipts is the same document shape, but the debit side is by
   definition the cash/bank account — labelled as such instead of a generic
   "Debit Account", matching how SmartLife presents a cash receipt. */
const CASH_RECEIPT_COLUMNS = RECEIPT_COLUMNS.map(col => {
  if (col.key === 'debit_account_number') return { ...col, label: 'Cash A/C #' };
  if (col.key === 'debit_account') return { ...col, label: 'Cash Account (Debit)' };
  return col;
});

/* Sort options offered in the UI. `key` is what the API accepts (see
   reportQuery.js SORT_FIELDS + the adapter's SORT_KEYS). */
const COMMON_SORTS = [
  { key: 'entry', label: 'Entry / Record #' },
  { key: 'reference', label: 'Reference' },
  { key: 'date', label: 'Date' },
];

const LEDGER_REPORTS = {
  'daily-move': {
    key: 'daily-move',
    title: 'Daily Move',
    description: 'Journal/ledger movement from the synchronized SmartERP general ledger',
    apiPath: '/api/smartlife/daily-move',
    pagePath: '/smartlife/daily-move',
    columns: DAILY_MOVE_COLUMNS,
    orientation: 'landscape',
    sorts: [...COMMON_SORTS,
      { key: 'account_number', label: 'Account #' },
      { key: 'account_name', label: 'Account Name' },
      { key: 'type', label: 'Type' },
      { key: 'debit', label: 'Debit' },
      { key: 'credit', label: 'Credit' },
    ],
    totals: [
      { label: 'Rows', key: 'rows', count: true },
      { label: 'Total Debit', key: 'debit' },
      { label: 'Total Credit', key: 'credit' },
      { label: 'Net (Debit − Credit)', key: 'net' },
    ],
  },
  receipts: {
    key: 'receipts',
    title: 'Receipts',
    description: 'SmartERP receipt documents from the synchronized general ledger',
    apiPath: '/api/smartlife/receipts',
    pagePath: '/smartlife/receipts',
    columns: RECEIPT_COLUMNS,
    orientation: 'landscape',
    /* Receipt # opens the real SmartLife-style voucher document. */
    documentColumn: 'receipt_number',
    sorts: [...COMMON_SORTS,
      { key: 'account_name', label: 'Debit Account' },
      { key: 'amount', label: 'Amount' },
    ],
    totals: [
      { label: 'Receipts', key: 'rows', count: true },
      { label: 'Total Amount', key: 'amount' },
    ],
  },
  'cash-receipts': {
    key: 'cash-receipts',
    title: 'Cash Receipts',
    description: 'SmartERP cash-receipt documents from the synchronized general ledger',
    apiPath: '/api/smartlife/cash-receipts',
    pagePath: '/smartlife/cash-receipts',
    columns: CASH_RECEIPT_COLUMNS,
    orientation: 'landscape',
    documentColumn: 'receipt_number',
    sorts: [...COMMON_SORTS,
      { key: 'account_name', label: 'Cash Account' },
      { key: 'amount', label: 'Amount' },
    ],
    totals: [
      { label: 'Cash Receipts', key: 'rows', count: true },
      { label: 'Total Amount', key: 'amount' },
    ],
  },
};

/* Display formatting shared by every surface, so a number never renders one
   way on screen and another way in the export. */
function formatMoney(value) {
  if (value == null || value === '') return '';
  const number = Number(value);
  /* Normalize negative zero. A balanced period leaves Debit − Credit at
     -0 (a tiny negative float rounded down), which formats as "-0.00" — an
     accounting export must show a balanced total as 0.00, not a negative.
     Caught in the real Daily Move Excel export for August 2026. */
  return (number === 0 ? 0 : number).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatCell(row, column, { blank = '—' } = {}) {
  const value = row?.[column.key];
  if (column.money) return value == null || value === '' ? blank : formatMoney(value);
  return value == null || value === '' ? blank : String(value);
}

function totalsFor(report, totals) {
  if (!totals) return [];
  return report.totals
    .filter(spec => totals[spec.key] !== undefined && totals[spec.key] !== null)
    .map(spec => ({
      label: spec.label,
      value: spec.count ? String(totals[spec.key]) : formatMoney(totals[spec.key]),
    }));
}

function periodLabel(from, to) {
  if (from && to) return `${from} to ${to}`;
  if (from) return `From ${from}`;
  if (to) return `Until ${to}`;
  return 'All dates';
}

module.exports = {
  LEDGER_REPORTS, formatMoney, formatCell, totalsFor, periodLabel,
};
