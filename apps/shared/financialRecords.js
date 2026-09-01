'use strict';

const crypto = require('crypto');

const RESOURCE_TYPES = Object.freeze({ 'sales-invoices': 'sales_invoice', purchases: 'purchase_invoice' });

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
  const explicitId = first(record, ['id','invoice_id','expense_id','uuid','reference_no','number','invoice_number','reference']);
  const externalId = explicitId == null
    ? crypto.createHash('sha256').update(JSON.stringify(raw)).digest('hex')
    : String(explicitId);
  const total = amount(record, ['grand_total','total_amount','total','net_total','amount']);
  const paid = amount(record, ['paid_amount','amount_paid','paid','payment_total']);
  const explicitBalance = first(record, ['balance_amount','remaining_balance','balance','due_amount']);
  return {
    tenant_id: 'alfarooque', source_system: 'smartlife', record_type: recordType, external_id: externalId,
    source_reference: String(first(record, ['reference_no','invoice_number','number','reference','code']) || externalId),
    party_name: first(record, ['customer','supplier','customer_name','supplier_name','vendor_name','party_name']),
    record_date: date(record, ['date','invoice_date','expense_date','created_at']),
    due_date: date(record, ['due_date','payment_due_date']),
    currency: String(first(record, ['currency','currency_code']) || 'SAR'),
    /* SmartERP's documented Sale object names these `total` (net, pre-tax) and
       `total_tax` — verified against the live API, where `total_tax` carries
       the real VAT and the generic guesses below never matched, so every
       stored vat_amount silently normalized to 0 despite invoices having real
       tax on their line items. */
    subtotal: amount(record, ['total','subtotal','sub_total','net_amount']),
    vat_amount: amount(record, ['total_tax','vat_amount','tax_amount','vat','tax']),
    total_amount: total, paid_amount: paid,
    balance_amount: explicitBalance == null ? Math.max(total - paid, 0) : Number(explicitBalance) || 0,
    source_status: first(record, ['payment_status','status','invoice_status']), raw_payload: raw,
    source_updated_at: first(record, ['updated_at','modified_at','last_update']) || null,
    last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
}

/* SmartERP's own `updated_at`/`modified_at` is unreliable as a change signal
   — verified live on real synced sales/purchase invoices, it is `null` on
   every record, so it cannot drive incremental sync (this is a genuine API
   data limitation, not something to fabricate around). What IS reliable:
   the exact same raw_payload JSON this function already stores per row.
   Comparing the incoming payload against what's already on disk (one SELECT
   over the resource's existing rows, then a plain string compare) lets an
   unchanged record skip the UPDATE entirely — the documented list endpoint
   still has to be walked in full every sync (no bulk incremental endpoint
   exists), but the database write, which is the actual cost this matters
   for, only happens for records that are genuinely new or changed. */
async function upsertSmartErpFinancialRecords(sb, resource, records) {
  const recordType = RESOURCE_TYPES[resource];
  const rows = (records || []).map(record => normalizeSmartErpFinancialRecord(resource, record)).filter(Boolean);
  if (!rows.length) return { total: 0, written: 0, unchanged: 0 };

  const existingByExternalId = new Map();
  if (recordType) {
    const { data: existing, error: readError } = await sb.from('erp_financial_source_records')
      .select('external_id, raw_payload')
      .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('record_type', recordType);
    if (readError) throw readError;
    for (const row of existing || []) existingByExternalId.set(row.external_id, JSON.stringify(row.raw_payload));
  }
  const toWrite = rows.filter(row => JSON.stringify(row.raw_payload) !== existingByExternalId.get(row.external_id));

  for (let offset = 0; offset < toWrite.length; offset += 500) {
    const { error } = await sb.from('erp_financial_source_records').upsert(toWrite.slice(offset, offset + 500), {
      onConflict: 'tenant_id,source_system,record_type,external_id', ignoreDuplicates: false,
    });
    if (error) throw error;
  }
  return { total: rows.length, written: toWrite.length, unchanged: rows.length - toWrite.length };
}

module.exports = { RESOURCE_TYPES, normalizeSmartErpFinancialRecord, upsertSmartErpFinancialRecords };
