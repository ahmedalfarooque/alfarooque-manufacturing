'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { amountInWords } = require('./amountInWords');
const { LEDGER_REPORTS, formatCell, totalsFor, periodLabel } = require('./ledgerReportDefs');

test('amount in words matches the SmartLife voucher convention', () => {
  /* The reference voucher prints 85.0000 as "eighty-five saudi riyals zero
     halalas" — same wording, same halala handling. */
  assert.equal(amountInWords(85), 'eighty-five saudi riyals zero halalas');
  assert.equal(amountInWords(5000), 'five thousand saudi riyals zero halalas');
  assert.equal(amountInWords(160.01), 'one hundred sixty saudi riyals one halalas');
  assert.equal(amountInWords(0), 'zero saudi riyals zero halalas');
  assert.equal(amountInWords(1234567.89), 'one million two hundred thirty-four thousand five hundred sixty-seven saudi riyals eighty-nine halalas');
});

test('amount in words rounds the same way the printed figure does', () => {
  /* 160.0098 prints as 160.01 — the words must agree, never disagree. */
  assert.equal(amountInWords(160.0098), 'one hundred sixty saudi riyals one halalas');
  assert.equal(amountInWords('not a number'), '');
});

test('every report column maps to a real adapter field name', () => {
  /* Guards against a column silently referencing a key the adapter never
     produces — which is what makes a PDF/Excel column come out empty. */
  const dailyMoveFields = new Set(['date', 'time', 'document_number', 'reference_number', 'transaction_type',
    'account_number', 'account_name', 'description', 'cost_center', 'debit', 'credit', 'balance',
    'branch_name', 'branch_id', 'transaction_id', 'amount', 'currency']);
  for (const col of LEDGER_REPORTS['daily-move'].columns) {
    assert.ok(dailyMoveFields.has(col.key), `unknown Daily Move column key: ${col.key}`);
  }
  const receiptFields = new Set(['receipt_id', 'receipt_number', 'reference', 'date', 'time',
    'debit_account_number', 'debit_account', 'credit_account_number', 'credit_account', 'description',
    'cost_center', 'amount', 'credit_total', 'currency', 'branch', 'branch_id', 'status']);
  for (const key of ['receipts', 'cash-receipts']) {
    for (const col of LEDGER_REPORTS[key].columns) {
      assert.ok(receiptFields.has(col.key), `unknown ${key} column key: ${col.key}`);
    }
  }
});

test('every sort option is one the API accepts', () => {
  const accepted = new Set(['entry', 'reference', 'date', 'account_number', 'account_name', 'type', 'debit', 'credit', 'amount']);
  for (const report of Object.values(LEDGER_REPORTS)) {
    for (const option of report.sorts) assert.ok(accepted.has(option.key), `unsupported sort: ${option.key}`);
    assert.equal(report.sorts[0].key, 'entry', 'record number must be the first/default sort option');
  }
});

test('money cells format identically everywhere, blanks configurable', () => {
  const col = LEDGER_REPORTS['daily-move'].columns.find(c => c.key === 'debit');
  assert.equal(formatCell({ debit: 5000 }, col), '5,000.00');
  assert.equal(formatCell({ debit: null }, col), '—');
  /* Exports pass blank:'' so an empty PDF/Excel cell is truly empty. */
  assert.equal(formatCell({ debit: null }, col, { blank: '' }), '');
});

test('totals only surface values the adapter actually returned', () => {
  const report = LEDGER_REPORTS['daily-move'];
  const totals = totalsFor(report, { rows: 2, debit: 5000, credit: 5000, net: 0 });
  assert.deepEqual(totals.map(t => t.label), ['Rows', 'Total Debit', 'Total Credit', 'Net (Debit − Credit)']);
  assert.equal(totals[0].value, '2');
  assert.equal(totals[1].value, '5,000.00');
  /* A missing total is omitted, never rendered as a fabricated 0. */
  assert.equal(totalsFor(report, { rows: 2 }).length, 1);
  assert.deepEqual(totalsFor(report, null), []);
});

test('period label never invents a range', () => {
  assert.equal(periodLabel('2026-01-01', '2026-08-21'), '2026-01-01 to 2026-08-21');
  assert.equal(periodLabel('2026-01-01', null), 'From 2026-01-01');
  assert.equal(periodLabel(null, null), 'All dates');
});
