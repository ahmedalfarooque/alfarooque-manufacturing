'use strict';

const { normalizeSmartErpSourceMapping } = require('../../shared/integrationPlatform');

const QUOTEPRO_SMARTLIFE_RESOURCES = Object.freeze([
  'customers', 'products', 'categories', 'units', 'brands', 'suppliers', 'warehouses', 'tax',
]);

function first(record, keys, fallback = null) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return fallback;
}

function decimal(record, keys) {
  const value = Number(first(record, keys, 0));
  return Number.isFinite(value) ? value : 0;
}

function normalizeSmartLifeMaster(resource, record) {
  if (!QUOTEPRO_SMARTLIFE_RESOURCES.includes(resource) || !record || typeof record !== 'object') return null;
  const mapping = normalizeSmartErpSourceMapping(resource, record);
  if (!mapping) return null;
  const sourceRecordId = mapping.source_record_id;
  const common = {
    source: 'SMARTLIFE', source_record_id: sourceRecordId,
    code: String(first(record, ['code', 'product_code', 'client_code', 'supplier_code', 'sku', 'reference'], '') || ''),
    name: String(first(record, ['name', 'product_name', 'company_name', 'client_name', 'customer_name', 'supplier_name', 'title'], '') || ''),
  };

  if (resource === 'customers') {
    const companyName = String(first(record, ['company_name', 'client_name', 'customer_name', 'name', 'full_name'], '') || '');
    return {
      ...common, company_name: companyName, full_name: companyName,
      contact_person: first(record, ['contact_person', 'contact_name', 'representative']),
      phone: first(record, ['phone', 'mobile', 'mobile_number', 'phone_number', 'telephone']),
      email: first(record, ['email', 'email_address']),
      address: first(record, ['address', 'street_address']), city: first(record, ['city']),
      vat_number: first(record, ['vat_number', 'tax_number', 'trn']), cr_number: first(record, ['cr_number', 'commercial_registration']),
    };
  }

  if (resource === 'products') {
    return {
      ...common,
      name: String(first(record, ['product_name', 'name', 'title'], '') || ''),
      description: first(record, ['description', 'product_description', 'details']),
      barcode: first(record, ['barcode', 'bar_code']), sku: first(record, ['sku', 'product_code', 'code']),
      category: first(record, ['category_name', 'category']), brand: first(record, ['brand_name', 'brand']),
      unit: String(first(record, ['unit_name', 'unit', 'measurement_unit'], 'nos') || 'nos'),
      standard_price: decimal(record, ['sale_price', 'selling_price', 'price', 'unit_price', 'retail_price']),
    };
  }

  if (resource === 'suppliers') {
    return {
      ...common,
      name: String(first(record, ['supplier_name', 'company_name', 'name'], '') || ''),
      contact_person: first(record, ['contact_person', 'contact_name']),
      phone: first(record, ['phone', 'mobile', 'mobile_number', 'phone_number']), email: first(record, ['email']),
      address: first(record, ['address']), vat_number: first(record, ['vat_number', 'tax_number', 'trn']),
      cr_number: first(record, ['cr_number', 'commercial_registration']),
    };
  }

  return common;
}

module.exports = { QUOTEPRO_SMARTLIFE_RESOURCES, normalizeSmartLifeMaster };
