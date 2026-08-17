'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { QUOTEPRO_SMARTLIFE_RESOURCES, normalizeSmartLifeMaster } = require('./smartlifeMasterData');

test('QuotePro exposes only verified SmartERP master-data resources', () => {
  assert.deepEqual(QUOTEPRO_SMARTLIFE_RESOURCES, [
    'customers', 'products', 'categories', 'units', 'brands', 'suppliers', 'warehouses', 'tax',
  ]);
  assert.equal(normalizeSmartLifeMaster('quotations', { id: 1, name: 'Never allowed' }), null);
});

test('normalizes a SmartERP customer without inventing identity fields', () => {
  const row = normalizeSmartLifeMaster('customers', {
    id: 473, client_name: 'Actual Customer', mobile: '0500000000', tax_number: '310000000000003',
  });
  assert.equal(row.source_record_id, '473');
  assert.equal(row.company_name, 'Actual Customer');
  assert.equal(row.phone, '0500000000');
  assert.equal(row.vat_number, '310000000000003');
  assert.equal(row.email, null);
});

test('normalizes product price and unit for a stable local catalogue snapshot', () => {
  const row = normalizeSmartLifeMaster('products', {
    product_id: 91, product_name: 'Desk', product_code: 'SKU-91', sale_price: '172.50', unit_name: 'nos',
  });
  assert.equal(row.source_record_id, '91');
  assert.equal(row.name, 'Desk');
  assert.equal(row.code, 'SKU-91');
  assert.equal(row.standard_price, 172.5);
  assert.equal(row.unit, 'nos');
});
