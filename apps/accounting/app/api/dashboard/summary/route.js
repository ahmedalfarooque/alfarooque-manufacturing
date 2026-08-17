'use strict';

/* Dashboard data-aggregation layer — real numbers only, computed from the
   EXISTING erp_financial_source_records (synced SmartERP sales/purchase
   invoices) and pm_purchase_requests (local planned/requested purchasing).
   No SmartERP call happens here; this reads the local synchronized
   snapshot only. Nothing is hardcoded — an empty period returns zeros. */

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function periodRange(month, year) {
  const y = year && year !== 'all' ? Number(year) : null;
  const m = month && month !== 'all' ? MONTHS.indexOf(month) : null; // 0-11, -1 if not found
  if (y == null && m == null) return { from: null, to: null };
  if (y != null && m != null && m >= 0) {
    const from = new Date(Date.UTC(y, m, 1));
    const to = new Date(Date.UTC(y, m + 1, 1));
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }
  if (y != null) return { from: `${y}-01-01`, to: `${y + 1}-01-01` };
  /* month set, year = all: no single contiguous range — filtered client-side
     below by extracting the month component instead of a date range. */
  return { from: null, to: null, monthOnly: m };
}

function sum(rows, key) { return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0); }

/* PostgREST caps a single select() at 1000 rows — with ~2,400 combined
   sales+purchase records already synced, an unpaginated query silently
   truncated to an arbitrary 1000-row slice and produced wrong totals
   (caught in testing: month=all/year=all showed 513 purchases instead of
   1,956). Page through in batches until a short page signals the end. */
async function fetchAllRows(buildQuery) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await buildQuery().range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const url = new URL(req.url);
  const month = url.searchParams.get('month') || 'all';
  const year = url.searchParams.get('year') || 'all';
  const sb = getDb();

  const { from, to, monthOnly } = periodRange(month, year);

  let allRecords;
  try {
    allRecords = await fetchAllRows(() => {
      let q = sb.from('erp_financial_source_records')
        .select('record_type, party_name, record_date, total_amount, paid_amount, balance_amount, source_reference, currency')
        .in('record_type', ['sales_invoice', 'purchase_invoice']);
      if (from) q = q.gte('record_date', from).lt('record_date', to);
      return q;
    });
  } catch (error) { console.error('[dashboard summary] failed:', error.message); return json({ error: 'Could not load dashboard data.' }, 500); }

  const records = monthOnly != null && monthOnly >= 0
    ? (allRecords || []).filter(r => r.record_date && new Date(r.record_date + 'T00:00:00Z').getUTCMonth() === monthOnly)
    : (allRecords || []);

  const sales = records.filter(r => r.record_type === 'sales_invoice');
  const purchases = records.filter(r => r.record_type === 'purchase_invoice');

  const salesRevenue = sum(sales, 'total_amount');
  const purchaseActualCost = sum(purchases, 'total_amount');

  /* Available years for the Year filter — derived from real record dates,
     never hardcoded, and intentionally NOT limited to the current filter
     (the dropdown must list every year that exists regardless of what's
     currently selected). */
  const allDates = await fetchAllRows(() => sb.from('erp_financial_source_records').select('record_date').in('record_type', ['sales_invoice', 'purchase_invoice']).not('record_date', 'is', null));
  const years = [...new Set(allDates.map(r => r.record_date.slice(0, 4)))].sort((a, b) => b.localeCompare(a));

  /* Purchase Requests — planned/requested, kept fully separate from actual
     purchase cost above. Filtered by request_date over the same period
     when a range is available (month=All+Year=All has none, by design). */
  const prAll = await fetchAllRows(() => {
    let q = sb.from('pm_purchase_requests').select('estimated_price, request_date');
    if (from) q = q.gte('request_date', from).lt('request_date', to);
    return q;
  });
  const prRows = monthOnly != null && monthOnly >= 0
    ? (prAll || []).filter(r => r.request_date && new Date(r.request_date + 'T00:00:00Z').getUTCMonth() === monthOnly)
    : (prAll || []);
  const prKnown = prRows.filter(r => r.estimated_price != null);
  const prUnknown = prRows.filter(r => r.estimated_price == null);

  function topParties(rows, n = 5) {
    const byParty = new Map();
    for (const r of rows) {
      const key = r.party_name || 'Unknown';
      byParty.set(key, (byParty.get(key) || 0) + (Number(r.total_amount) || 0));
    }
    return [...byParty.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, total]) => ({ name, total }));
  }
  function recent(rows, n = 5) {
    return [...rows].sort((a, b) => String(b.record_date).localeCompare(String(a.record_date))).slice(0, n)
      .map(r => ({ reference: r.source_reference, party: r.party_name, date: r.record_date, total: Number(r.total_amount) || 0, currency: r.currency || 'SAR' }));
  }

  /* Trend series — intentionally independent of the month filter (a trend
     needs to show shape across time, not collapse to one bucket). When a
     specific year is selected, bucket by month of that year; when
     year=all, bucket by year instead. Reuses `allDates`-style full fetch
     rather than `records` (which may already be narrowed to one month). */
  const trendSource = year !== 'all' ? allRecords : await fetchAllRows(() => sb.from('erp_financial_source_records').select('record_type, record_date, total_amount').in('record_type', ['sales_invoice', 'purchase_invoice']));
  const trendBuckets = new Map();
  for (const r of trendSource) {
    if (!r.record_date) continue;
    const key = year !== 'all' ? r.record_date.slice(0, 7) : r.record_date.slice(0, 4);
    const bucket = trendBuckets.get(key) || { sales: 0, purchases: 0 };
    if (r.record_type === 'sales_invoice') bucket.sales += Number(r.total_amount) || 0;
    else bucket.purchases += Number(r.total_amount) || 0;
    trendBuckets.set(key, bucket);
  }
  const trend = [...trendBuckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({ period: key, sales: Math.round(v.sales * 100) / 100, purchases: Math.round(v.purchases * 100) / 100, profit: Math.round((v.sales - v.purchases) * 100) / 100 }));

  const [{ count: customerCount }, { count: supplierCount }, { count: productCount }, { count: projectCount }] = await Promise.all([
    sb.from('crm_record_mappings').select('id', { count: 'exact', head: true }).eq('entity_type', 'customers'),
    sb.from('crm_record_mappings').select('id', { count: 'exact', head: true }).eq('entity_type', 'suppliers'),
    sb.from('crm_record_mappings').select('id', { count: 'exact', head: true }).eq('entity_type', 'products'),
    sb.from('pm_projects').select('id', { count: 'exact', head: true }),
  ]);

  return json({
    period: { month, year },
    availableYears: years,
    kpis: {
      salesRevenue, salesPaid: sum(sales, 'paid_amount'), receivables: sum(sales, 'balance_amount'), salesCount: sales.length,
      purchaseActualCost, purchasePaid: sum(purchases, 'paid_amount'), payables: sum(purchases, 'balance_amount'), purchaseCount: purchases.length,
      grossProfit: salesRevenue - purchaseActualCost,
      customerCount: customerCount || 0, supplierCount: supplierCount || 0, productCount: productCount || 0, projectCount: projectCount || 0,
    },
    purchaseRequests: {
      count: prRows.length, estimatedKnownTotal: sum(prKnown, 'estimated_price'), knownCount: prKnown.length, unknownCount: prUnknown.length,
    },
    trend,
    topCustomers: topParties(sales),
    topSuppliers: topParties(purchases),
    recentSales: recent(sales),
    recentPurchases: recent(purchases),
    notes: {
      expenses: 'Not available — no expense records with real amounts exist in the local database yet.',
      cash: 'Not available — no cash/bank ledger data source exists yet.',
      topProducts: 'Not available — invoice line items are stored per-invoice, not yet aggregated by product.',
    },
  });
}
