'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildVatReport, matchesPeriod, normalizeFinancialDocument } = require('./financialReportData');

test('normalizes verified SmartLife money and date fields without floating-point artifacts', () => {
  const row = normalizeFinancialDocument('sales-invoices', {
    id: 12, date: '2026-08-13T22:10:00+03:00', customer: 'Customer', total: 172.5, total_tax: 22.499999999,
  });
  assert.equal(row.date, '2026-08-13');
  assert.equal(row.total, 172.5);
  assert.equal(row.vat, 22.5);
});

test('period filtering uses stored local date text and does not shift UTC+3 dates', () => {
  assert.equal(matchesPeriod('2026-08-13T00:10:00+03:00', '8', '2026'), true);
  assert.equal(matchesPeriod('2026-07-31T23:10:00Z', '8', '2026'), false);
});

test('VAT report keeps sales and purchase tax separate and calculates net VAT', () => {
  const report = buildVatReport(
    [{ id: 1, date: '2026-08-13', reference_no: 'S-1', customer: 'A', grand_total: 115, total_tax: 15 }],
    [{ id: 2, date: '2026-08-12', reference_no: 'P-1', supplier: 'B', grand_total: 57.5, tax: 7.5 }],
    '8', '2026',
  );
  assert.deepEqual(report.summary, { sales: 115, salesVat: 15, purchases: 57.5, purchaseVat: 7.5, netVat: 7.5, salesCount: 1, purchaseCount: 1 });
  assert.deepEqual(report.rows.map(r => r.type), ['Sale', 'Purchase']);
});
