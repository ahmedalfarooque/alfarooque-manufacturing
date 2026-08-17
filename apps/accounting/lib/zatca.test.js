'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ZatcaDataError, buildZatcaTlvBase64, decodeZatcaTlvBase64,
  buildSalesInvoiceZatcaData,
} = require('./zatca');

const EXAMPLE = Object.freeze({
  sellerName: 'مؤسسة السلطة الرائدة التجارية',
  vatNumber: '312417834200003',
  timestamp: '2026-08-10T17:15:00Z',
  total: '172.50',
  vatTotal: '22.50',
});

test('encodes ZATCA tags 1-5 as UTF-8 TLV and Base64 round-trips exact values', () => {
  const payload = buildZatcaTlvBase64(EXAMPLE);
  assert.match(payload, /^[A-Za-z0-9+/]+={0,2}$/);

  const decoded = decodeZatcaTlvBase64(payload);
  assert.deepEqual(decoded, {
    1: EXAMPLE.sellerName,
    2: EXAMPLE.vatNumber,
    3: EXAMPLE.timestamp,
    4: EXAMPLE.total,
    5: EXAMPLE.vatTotal,
  });

  const bytes = Buffer.from(payload, 'base64');
  let offset = 0;
  for (const [tag, value] of [[1, EXAMPLE.sellerName], [2, EXAMPLE.vatNumber], [3, EXAMPLE.timestamp], [4, EXAMPLE.total], [5, EXAMPLE.vatTotal]]) {
    const valueBytes = Buffer.from(value, 'utf8');
    assert.equal(bytes[offset], tag);
    assert.equal(bytes[offset + 1], valueBytes.length);
    assert.deepEqual(bytes.subarray(offset + 2, offset + 2 + valueBytes.length), valueBytes);
    offset += 2 + valueBytes.length;
  }
  assert.equal(offset, bytes.length);
});

test('sales invoice mapping uses stored timestamp and displayed grand total/VAT fields', () => {
  const result = buildSalesInvoiceZatcaData({
    date: EXAMPLE.timestamp, grand_total: '172.5000', total_tax: '22.5000',
  }, { sellerName: EXAMPLE.sellerName, vatNumber: EXAMPLE.vatNumber });
  assert.deepEqual(result.fields, { 1: EXAMPLE.sellerName, 2: EXAMPLE.vatNumber, 3: EXAMPLE.timestamp, 4: '172.50', 5: '22.50' });
});

test('normalizes stored SmartLife Saudi local timestamp without changing its wall-clock time', () => {
  const result = buildSalesInvoiceZatcaData({
    date: '2025-01-02 15:40:00', grand_total: '70.0400', total_tax: '9.1350',
  }, { sellerName: 'Seller', vatNumber: '312417834200003' });
  assert.equal(result.fields[3], '2025-01-02T15:40:00+03:00');
  assert.equal(result.fields[4], '70.04');
  assert.equal(result.fields[5], '9.14');
});

test('refuses to fabricate a QR when a required invoice field is absent', () => {
  assert.throws(() => buildSalesInvoiceZatcaData({ date: EXAMPLE.timestamp, grand_total: EXAMPLE.total }, {
    sellerName: EXAMPLE.sellerName, vatNumber: EXAMPLE.vatNumber,
  }), error => error instanceof ZatcaDataError && error.field === 'VAT total');
  assert.throws(() => buildZatcaTlvBase64({ ...EXAMPLE, timestamp: '2026-08-10' }), /stored invoice time/);
});
