'use strict';

const crypto = require('crypto');

const RESOURCE_TYPES = Object.freeze({ 'sales-invoices': 'sales_invoice', expenses: 'expense' });

function first(record, keys) {
  for (const key of keys) if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') return record[key];
  return null;
}

function amount(record, keys) {
  const value = Number(first(record, keys));
  return Number.isFinite(value) ? value : 0;
}

function date(record, keys) {
  const value = first(record, keys);
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function normalizeSmartErpFinancialRecord(resource, record) {
  const recordType = RESOURCE_TYPES[resource];
  if (!recordType || !record || typeof record !== 'object') return null;
  const raw = JSON.parse(JSON.stringify(record));
  const explicitId = first(record, ['id','invoice_id','expense_id','uuid','number','invoice_number','reference']);
  const externalId = explicitId == null
    ? crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex')
    : String(explicitId);
  const total = amount(record, ['grand_total','total_amount','total','net_total','amount']);
  const paid = amount(record, ['paid_amount','amount_paid','paid','payment_total']);
  const explicitBalance = first(record, ['balance_amount','remaining_balance','balance','due_amount']);
  return {
    tenant_id: 'alfarooque', source_system: 'smartlife', record_type: recordType, external_id: externalId,
    source_reference: String(first(record, ['invoice_number','number','reference','code']) || externalId),
    party_name: first(record, ['customer_name','supplier_name','vendor_name','party_name','customer','supplier']),
    record_date: date(record, ['invoice_date','expense_date','date','created_at']),
    due_date: date(record, ['due_date','payment_due_date']),
    currency: String(first(record, ['currency','currency_code']) || 'SAR'),
    subtotal: amount(record, ['subtotal','sub_total','net_amount']),
    vat_amount: amount(record, ['vat_amount','tax_amount','vat','tax']),
    total_amount: total, paid_amount: paid,
    balance_amount: explicitBalance == null ? Math.max(total - paid, 0) : Number(explicitBalance) || 0,
    source_status: first(record, ['payment_status','status','invoice_status']), raw_payload: raw,
    source_updated_at: first(record, ['updated_at','modified_at','last_update']) || null,
    last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
}

async function upsertSmartErpFinancialRecords(sb, resource, records) {
  const rows = (records || []).map(record => normalizeSmartErpFinancialRecord(resource, record)).filter(Boolean);
  for (let offset = 0; offset < rows.length; offset += 500) {
    const { error } = await sb.from('erp_financial_source_records').upsert(rows.slice(offset, offset + 500), {
      onConflict: 'tenant_id,source_system,record_type,external_id', ignoreDuplicates: false,
    });
    if (error) throw error;
  }
  return rows.length;
}

module.exports = { RESOURCE_TYPES, normalizeSmartErpFinancialRecord, upsertSmartErpFinancialRecords };
