'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { __testables } = require('./journalEntries');
const { normalizeEntry, normalizeLines, normalizeSide } = __testables;

/* Real SmartERP payload shape (entry 10202, verified live against the
   company's own ledger — values kept, nothing invented). */
const REAL_ENTRY = {
  id: '10202', related_id: '3463', date: '2026-08-19',
  description: 'partial settlement', confirm_by: '4', created_by: '0',
  modified_by: '0', date_time: '2026-08-19 10:52:59', updated_at: null,
  number: '20260003733', type: 'receipt', branch_id: '1', year: '2026',
  branch_name: 'Factory Store', editable: 1, none_editable_note: '',
  reference_number: '1412',
  details: [
    { account_id: 241, type: 'debit', value: 5000, branch_id: 1, account_num: 203010000036, name: 'Customer A', cost_center_id: 0, cost_center_name: '', cost_center_number: 0, statement: 'partial settlement' },
    { account_id: 447, type: 'credite', value: 5000, branch_id: 1, account_num: 10302002, name: 'Purchases Fund', cost_center_id: 0, cost_center_name: '', cost_center_number: 0, statement: 'partial settlement' },
  ],
  files: [],
};

test("normalizes SmartERP's 'credite' spelling to credit", () => {
  assert.equal(normalizeSide('credite'), 'credit');
  assert.equal(normalizeSide('credit'), 'credit');
  assert.equal(normalizeSide('debit'), 'debit');
  assert.equal(normalizeSide(''), 'unknown');
});

test('normalizes a real journal entry header without altering reported values', () => {
  const row = normalizeEntry(REAL_ENTRY);
  assert.equal(row.entry_id, '10202');
  assert.equal(row.entry_number, '20260003733');
  assert.equal(row.entry_date, '2026-08-19');
  assert.equal(row.entry_type, 'receipt');
  assert.equal(row.reference_number, '1412');
  assert.equal(row.branch_id, '1');
  assert.equal(row.fiscal_year, '2026');
  assert.equal(row.related_id, '3463');
  assert.equal(row.tenant_id, 'alfarooque');
  assert.equal(row.source_system, 'smartlife');
  assert.deepEqual(row.raw_payload, REAL_ENTRY);
});

test('only sets a timestamp when SmartERP actually reported a time', () => {
  assert.ok(normalizeEntry(REAL_ENTRY).entry_datetime.startsWith('2026-08-19T10:52:59'));
  const dateOnly = normalizeEntry({ ...REAL_ENTRY, date_time: '2026-08-19' });
  assert.equal(dateOnly.entry_datetime, null, 'a date with no time must not become a fabricated midnight timestamp');
});

test('normalizes every detail line with its real account and side', () => {
  const lines = normalizeLines(REAL_ENTRY);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].side, 'debit');
  assert.equal(lines[0].value, 5000);
  assert.equal(lines[0].account_number, '203010000036');
  assert.equal(lines[0].account_name, 'Customer A');
  assert.equal(lines[0].line_index, 0);
  assert.equal(lines[1].side, 'credit');
  assert.equal(lines[1].account_number, '10302002');
  assert.equal(lines[1].line_index, 1);
  /* Debits must equal credits on a balanced entry — asserted, not assumed. */
  const debit = lines.filter(l => l.side === 'debit').reduce((s, l) => s + l.value, 0);
  const credit = lines.filter(l => l.side === 'credit').reduce((s, l) => s + l.value, 0);
  assert.equal(debit, credit);
});

test('rejects an entry with no id and never invents one', () => {
  assert.equal(normalizeEntry({ number: 'x', details: [] }), null);
  assert.deepEqual(normalizeLines({ details: [{ type: 'debit', value: 1 }] }), []);
});

test('empty strings become null rather than empty-string data', () => {
  const row = normalizeEntry({ ...REAL_ENTRY, description: '', reference_number: '' });
  assert.equal(row.description, null);
  assert.equal(row.reference_number, null);
  const lines = normalizeLines({ ...REAL_ENTRY, details: [{ type: 'debit', value: 5, cost_center_name: '' }] });
  assert.equal(lines[0].cost_center_name, null);
});
