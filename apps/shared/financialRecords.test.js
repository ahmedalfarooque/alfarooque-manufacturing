'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSmartErpFinancialRecord, upsertSmartErpFinancialRecords } = require('./financialRecords');

test('normalizes SmartERP sales invoices without changing source payload', () => {
  const source = { id: 42, invoice_number: 'SI-42', customer_name: 'Example', invoice_date: '2026-08-10', subtotal: '100', vat_amount: '15', grand_total: '115', paid_amount: '30' };
  const row = normalizeSmartErpFinancialRecord('sales-invoices', source);
  assert.equal(row.external_id, '42');
  assert.equal(row.record_type, 'sales_invoice');
  assert.equal(row.total_amount, 115);
  assert.equal(row.balance_amount, 85);
  assert.deepEqual(source, { id: 42, invoice_number: 'SI-42', customer_name: 'Example', invoice_date: '2026-08-10', subtotal: '100', vat_amount: '15', grand_total: '115', paid_amount: '30' });
});

test('uses stable source identity and idempotent upsert conflict columns', async () => {
  const calls = [];
  const chain = { eq: () => chain, select: () => chain, then: (resolve) => resolve({ data: [], error: null }) };
  const sb = { from: table => ({ ...chain, upsert: async (rows, options) => { calls.push({ table, rows, options }); return { error: null }; } }) };
  await upsertSmartErpFinancialRecords(sb, 'sales-invoices', [{ id: 'same', total: 10 }, { id: 'same', total: 20 }]);
  assert.equal(calls[0].table, 'erp_financial_source_records');
  assert.equal(calls[0].options.onConflict, 'tenant_id,source_system,record_type,external_id');
  assert.equal(calls[0].rows[0].external_id, calls[0].rows[1].external_id);
});

test('skips rewriting a record whose SmartERP payload is unchanged', async () => {
  const writeCalls = [];
  const existingRow = { external_id: '1', raw_payload: { id: 1, total: 10 } };
  const chain = { eq: () => chain, select: () => chain, then: (resolve) => resolve({ data: [existingRow], error: null }) };
  const sb = { from: () => ({ ...chain, upsert: async (rows) => { writeCalls.push(...rows); return { error: null }; } }) };
  const result = await upsertSmartErpFinancialRecords(sb, 'sales-invoices', [{ id: 1, total: 10 }, { id: 2, total: 20 }]);
  assert.equal(result.total, 2);
  assert.equal(result.written, 1);
  assert.equal(result.unchanged, 1);
  assert.equal(writeCalls.length, 1);
  assert.equal(writeCalls[0].external_id, '2');
});

test('does not invent unsupported SmartERP financial resources', () => {
  assert.equal(normalizeSmartErpFinancialRecord('purchase-invoices', { id: 1 }), null);
  assert.equal(normalizeSmartErpFinancialRecord('payments', { id: 1 }), null);
});
