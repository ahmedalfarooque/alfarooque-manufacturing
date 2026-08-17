'use strict';

/* Purchases and Sales Invoices are local-first (erp_financial_source_records,
   kept current by the existing canonical Sync job). VAT Report and the
   Financial Reports hub used to call readAllSmartLife() directly for these
   same two resources on every page load — a live, up-to-20-page SmartERP
   walk that duplicated data already sitting in Postgres. That live call
   existed specifically because the local snapshot could disagree with a
   separate live Dashboard read; now that Purchases/Sales Invoices pages
   themselves also read this same table, everything already agrees by
   construction, so the duplicate live fetch is removed here too — raw_payload
   is the exact original SmartERP record, so callers mapping over
   `.records` need no changes. */
async function readLocalFinancialRecords(sb, recordType) {
  /* PostgREST caps an unranged select at its default row limit (1,000) —
     without an explicit .range() a table with more rows than that (e.g.
     1,987 purchases) would silently truncate. Walk in pages until a
     short page signals the end, same stop condition used elsewhere in
     this codebase for paginated SmartERP reads. */
  const pageSize = 1000;
  const records = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await sb.from('erp_financial_source_records')
      .select('raw_payload')
      .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('record_type', recordType)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    records.push(...(data || []).map(row => row.raw_payload));
    if (!data || data.length < pageSize) break;
  }
  return { records };
}

/* Real Period-Balance activity for Trial Balance's two control-account
   roots (10201 "العملاء ( رئيسي )" / Customers, and 20301 "الدائنون
   المحليون" / Suppliers-Creditors). This is a genuine, verifiable
   transactional fact — the sum of real, already-synced sales/purchase
   invoice totals dated within [from,to] — not an invented figure.
   IMPORTANT LIMITATION, kept honest rather than glossed over: SmartERP's
   sales/purchase invoice records carry a free-text customer/supplier NAME,
   not a link to a specific individual sub-account under 10201/20301 (there
   is no field tying e.g. "شركه المصمم الحديث للمقاولات" to account number
   1020100001) — so this total is only mathematically sound at the ROOT
   account level (all invoices in range necessarily move the Customers/
   Suppliers control account in aggregate), never attributable to one
   individual child account. Every other account, and every child under
   these two roots, has no real transactional source and stays "N/A".
   "Beginning of period" (the running balance AS OF `from`) is NOT
   computed anywhere in this file even for these two roots: that requires
   knowing when each invoice was actually PAID, which this data does not
   carry (only the invoice's current outstanding balance right now, not a
   history of balance-over-time) — so it would be a real number computed
   from a comparison that can't actually answer the question asked of it,
   which is indistinguishable from fabrication. Left "N/A" everywhere. */
async function computePeriodActivity(sb, from, to) {
  if (!from || !to) return null;
  const sumInRange = async (recordType) => {
    const { data, error } = await sb.from('erp_financial_source_records')
      .select('total_amount')
      .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('record_type', recordType)
      .gte('record_date', from).lte('record_date', to);
    if (error) throw error;
    return roundMoney((data || []).reduce((sum, row) => sum + (Number(row.total_amount) || 0), 0));
  };
  const [customerDebit, supplierCredit] = await Promise.all([
    sumInRange('sales_invoice'), sumInRange('purchase_invoice'),
  ]);
  return { customerDebit, supplierCredit };
}

function first(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function dateKey(value) {
  if (!value) return null;
  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function normalizeFinancialDocument(resource, record) {
  const total = roundMoney(first(record, ['grand_total', 'total_amount', 'total', 'net_total', 'amount']));
  const paid = roundMoney(first(record, ['paid_amount', 'amount_paid', 'paid', 'payment_total']));
  const balanceValue = first(record, ['balance_amount', 'remaining_balance', 'balance', 'due_amount']);
  return {
    id: String(first(record, ['id', 'invoice_id', 'uuid', 'reference_no', 'number', 'invoice_number', 'reference']) || ''),
    reference: String(first(record, ['reference_no', 'invoice_number', 'number', 'reference', 'code']) || ''),
    date: dateKey(first(record, ['invoice_date', 'date', 'created_at'])),
    party: String(first(record, resource === 'purchases'
      ? ['supplier', 'supplier_name', 'party_name']
      : ['customer', 'customer_name', 'party_name']) || ''),
    subtotal: roundMoney(first(record, ['subtotal', 'sub_total', 'net_amount', 'total'])),
    vat: roundMoney(first(record, ['total_tax', 'vat_amount', 'tax_amount', 'vat', 'tax'])),
    total,
    paid,
    balance: balanceValue == null ? roundMoney(Math.max(total - paid, 0)) : roundMoney(balanceValue),
    currency: String(first(record, ['currency', 'currency_code']) || 'SAR'),
  };
}

function matchesPeriod(value, month = 'all', year = 'all') {
  const date = dateKey(value);
  if (!date) return month === 'all' && year === 'all';
  const [recordYear, recordMonth] = date.split('-');
  if (year !== 'all' && recordYear !== String(year)) return false;
  if (month !== 'all' && Number(recordMonth) !== Number(month)) return false;
  return true;
}

/* Custom From/To range — local calendar-date semantics (dateKey already
   extracts the plain YYYY-MM-DD prefix, never converted through
   toISOString()/UTC, so a date typed as 17/08/2026 means that exact Saudi
   calendar day, inclusive on both ends). Takes priority over month/year
   when either bound is set, so the two controls never silently conflict. */
function matchesRange(value, from, to) {
  const date = dateKey(value);
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function periodLabel(month = 'all', year = 'all') {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  if (month === 'all' && year === 'all') return 'All available dates';
  if (month === 'all') return String(year);
  const name = months[Number(month) - 1] || `Month ${month}`;
  return year === 'all' ? `${name} · all years` : `${name} ${year}`;
}

function buildVatReport(salesRecords, purchaseRecords, month = 'all', year = 'all', from = '', to = '') {
  const useRange = !!(from || to);
  const matches = r => useRange ? matchesRange(r.date, from, to) : matchesPeriod(r.date, month, year);
  const sales = (salesRecords || []).map(r => normalizeFinancialDocument('sales-invoices', r)).filter(matches);
  const purchases = (purchaseRecords || []).map(r => normalizeFinancialDocument('purchases', r)).filter(matches);
  const rows = [
    ...sales.map(r => ({ ...r, type: 'Sale', vatDirection: 'Output VAT' })),
    ...purchases.map(r => ({ ...r, type: 'Purchase', vatDirection: 'Input VAT' })),
  ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.id).localeCompare(String(a.id)));
  const sum = (items, key) => roundMoney(items.reduce((total, row) => total + (Number(row[key]) || 0), 0));
  const salesVat = sum(sales, 'vat');
  const purchaseVat = sum(purchases, 'vat');
  const rangeLabel = from && to ? `${from} → ${to}` : from ? `From ${from}` : to ? `Until ${to}` : null;
  return {
    period: { month, year, from, to, label: useRange ? rangeLabel : periodLabel(month, year) },
    summary: {
      sales: sum(sales, 'total'),
      salesVat,
      purchases: sum(purchases, 'total'),
      purchaseVat,
      netVat: roundMoney(salesVat - purchaseVat),
      salesCount: sales.length,
      purchaseCount: purchases.length,
    },
    rows,
    availableYears: [...new Set(rows.map(r => r.date?.slice(0, 4)).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
  };
}

module.exports = { first, roundMoney, dateKey, normalizeFinancialDocument, matchesPeriod, periodLabel, buildVatReport, readLocalFinancialRecords, computePeriodActivity };
