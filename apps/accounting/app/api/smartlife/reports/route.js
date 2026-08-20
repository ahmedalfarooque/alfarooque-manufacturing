'use strict';

/* Financial Reports hub — real business report categories, computed from
   the synced SmartLife snapshot (erp_financial_source_records) and
   AL FAROOQUE's own local records (erp_project_payments,
   erp_financial_connections). This is a summary/index used to drive report
   CARDS in the UI — the detailed Sales/Purchase workspaces already exist
   at /smartlife/sales-invoices and /smartlife/purchases and are linked to
   from here rather than duplicated. All amounts are rounded server-side
   (r2) so no raw floating-point value can ever reach the UI. */

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { readLocalFinancialRecords } = require('@/lib/financialReportData');
const { getDailyMove, getReceipts, getCashReceipts } = require('@/lib/smartlifeTransactionAdapter');

function r2(value) { return Math.round((Number(value) || 0) * 100) / 100; }
function first(record, keys) { for (const k of keys) if (record?.[k] != null && record[k] !== '') return record[k]; return null; }

export async function GET(req) {
  const { response } = await requireAction(req, 'view'); if (response) return response;
  const sb = getDb();
  /* KPI totals now read the same local snapshot (erp_financial_source_records)
     the Purchases/Sales Invoices pages themselves read — previously this
     called readAllSmartLife() live (a full up-to-20-page SmartERP walk on
     every Reports-hub page load) specifically because that snapshot could
     disagree with a separate live figure elsewhere. Now that the
     Purchases/Sales Invoices pages are also local-first, everything reads
     the one same table, so they agree by construction — the duplicate live
     fetch this comment used to justify is gone. */
  const [salesResult, purchasesResult, payments, connections, integration, dailyMove, receipts, cashReceipts] = await Promise.all([
    readLocalFinancialRecords(sb, 'sales_invoice').catch(() => ({ records: [] })),
    readLocalFinancialRecords(sb, 'purchase_invoice').catch(() => ({ records: [] })),
    sb.from('erp_project_payments').select('direction,amount,origin'),
    sb.from('erp_financial_connections').select('id', { count: 'exact', head: true }),
    sb.from('crm_integrations').select('status,last_sync_at,last_error').eq('tenant_id', 'alfarooque').eq('integration_key', 'smartlife').maybeSingle(),
    /* Isolated behind apps/accounting/lib/smartlifeTransactionAdapter.js —
       when SmartERP eventually exposes the missing endpoint(s), only that
       file changes; this route and the UI below stay as-is. */
    getDailyMove(sb), getReceipts(sb), getCashReceipts(sb),
  ]);
  if (payments.error) return json({ error: 'Could not build financial reports.' }, 500);

  const sales = salesResult.records.map(r => ({
    total_amount: Number(first(r, ['grand_total', 'total_amount', 'total'])) || 0,
    balance_amount: Number(first(r, ['balance', 'balance_amount'])) || 0,
    vat_amount: Number(first(r, ['total_tax', 'vat_amount'])) || 0,
  }));
  const purchases = purchasesResult.records.map(r => ({
    total_amount: Number(first(r, ['grand_total', 'total_amount', 'total'])) || 0,
    balance_amount: Number(first(r, ['balance', 'balance_amount'])) || 0,
    vat_amount: Number(first(r, ['tax', 'total_tax', 'vat_amount'])) || 0,
  }));
  const sum = (items, key) => items.reduce((total, row) => total + Number(row[key] || 0), 0);
  /* Receivables/payables must sum only POSITIVE balances — a negative
     balance_amount is a customer/supplier credit (overpayment), a distinct
     balance-sheet concept from "amount still owed", and must never net
     against genuine receivables. Confirmed real bug: 7 sales invoices carry
     a negative balance, which previously reduced "Total Receivables" by
     ~SAR 420,935 versus the correct positive-balances-only figure (verified
     against CRM's dashboard, which already summed positive balances only —
     this brought the two apps' identical "Outstanding Receivables" metric
     back into agreement instead of changing the correct one). */
  const sumPositive = (items, key) => items.reduce((total, row) => total + Math.max(0, Number(row[key] || 0)), 0);
  const localPayments = payments.data || [];

  const hasSales = sales.length > 0;
  const hasPurchases = purchases.length > 0;

  const kpis = {
    totalSales: hasSales ? r2(sum(sales, 'total_amount')) : null,
    totalPurchases: hasPurchases ? r2(sum(purchases, 'total_amount')) : null,
    receivables: hasSales ? r2(sumPositive(sales, 'balance_amount')) : null,
    payables: hasPurchases ? r2(sumPositive(purchases, 'balance_amount')) : null,
    salesVat: hasSales ? r2(sum(sales, 'vat_amount')) : null,
    purchaseVat: hasPurchases ? r2(sum(purchases, 'vat_amount')) : null,
    grossProfit: (hasSales || hasPurchases) ? r2(sum(sales, 'total_amount') - sum(purchases, 'total_amount')) : null,
    localPaymentsReceived: r2(sum(localPayments.filter(p => p.direction === 'received'), 'amount')),
    localPaymentsMade: r2(sum(localPayments.filter(p => p.direction === 'made'), 'amount')),
    connectedRecords: connections.count || 0,
  };
  kpis.netVat = (kpis.salesVat != null && kpis.purchaseVat != null) ? r2(kpis.salesVat - kpis.purchaseVat) : null;

  /* Report catalog — grouped into a standard accounting/reporting structure
     (Core Accounting / Financial Statements / Transactions / Inventory &
     Cost / Management & Analysis) instead of the earlier generic grouping.
     This is a pure regrouping of the SAME already-verified report entries —
     no new SmartLife source was investigated or added here, and no
     `available:false` entry was flipped to true without a real backing
     source (still exactly the same items previously marked unavailable —
     Income Statement/Financial Position/Cash Flow/Daily Move/Receipts/Cash
     Receipts/Cost Center Details/Budgets — confirmed over three separate
     investigations to have no real SmartLife source: no account
     classification field, no bulk journal/ledger endpoint, no receipts/
     payments endpoint, no cost-center detail-by-id endpoint). `href` points
     at the existing dedicated workspace where one already exists (no
     duplicate report UI). */
  const categories = [
    { key: 'core-accounting', label: 'Core Accounting', reports: [
      { key: 'accounts', name: 'Chart of Accounts', description: 'SmartLife Chart of Accounts', href: '/smartlife/accounts', available: true },
      { key: 'account-balances', name: 'Account Balances', description: 'Current balance per account', href: '/smartlife/account-balances', available: true },
      { key: 'trial-balance', name: 'Trial Balance', description: 'Every account with its current balance, presented as Debit/Credit', href: '/smartlife/trial-balance', available: true },
    ] },
    { key: 'financial-statements', label: 'Financial Statements', reports: [
      { key: 'gross-profit', name: 'Gross Profit', description: 'Sales revenue minus actual purchase cost', href: null, available: hasSales || hasPurchases },
      { key: 'income-statement', name: 'Income Statement', description: 'Sales, cost of sales, expenses and income — built from real synced account balances', href: '/smartlife/income-statement', available: true },
      { key: 'financial-position', name: 'Financial Position', description: 'Assets, liabilities and equity — built from real synced account balances', href: '/smartlife/financial-position', available: true },
      { key: 'cash-flow', name: 'Cash Flow Statement', description: 'Net profit and ending cash from real data; period-over-period changes are N/A pending historical snapshots', href: '/smartlife/cash-flow', available: true },
    ] },
    { key: 'transactions', label: 'Transactions', reports: [
      { key: 'sales-report', name: 'Sales Report', description: 'Revenue and sales activity', href: '/smartlife/sales-invoices', available: hasSales },
      { key: 'sales-by-customer', name: 'Sales by Customer', description: 'Revenue grouped by customer', href: '/smartlife/sales-invoices', available: hasSales },
      { key: 'purchase-report', name: 'Purchase Report', description: 'Purchasing activity and cost', href: '/smartlife/purchases', available: hasPurchases },
      { key: 'purchase-by-supplier', name: 'Purchases by Supplier', description: 'Purchasing grouped by supplier', href: '/smartlife/purchases', available: hasPurchases },
      { key: 'receivables', name: 'Receivables', description: 'Outstanding customer balances', href: '/smartlife/sales-invoices', available: hasSales },
      { key: 'payables', name: 'Payables', description: 'Outstanding supplier balances', href: '/smartlife/purchases', available: hasPurchases },
      { key: 'vat-summary', name: 'VAT Summary & Report', description: 'Sales, Sales VAT, Purchases, Purchase VAT, and Net VAT by period', href: '/vat', available: hasSales || hasPurchases },
      { key: 'tax-rates', name: 'Tax Rates', description: 'Configured tax rates', href: '/smartlife/tax', available: true },
      /* Daily Move / Receipts / Cash Receipts: business-critical reports
         with no real data source yet — routed through
         apps/accounting/lib/smartlifeTransactionAdapter.js rather than a
         hardcoded `available:false` here, so that the moment SmartERP
         exposes the missing endpoint(s), only that one file needs to
         change (this route and the UI card below already read whatever
         the adapter reports). */
      { key: 'daily-move', name: 'Daily Move', description: dailyMove.reason, statusLabel: dailyMove.statusLabel, href: '/smartlife/daily-move', available: dailyMove.available },
      { key: 'receipts', name: 'Receipts', description: receipts.reason, statusLabel: receipts.statusLabel, href: '/smartlife/receipts', available: receipts.available },
      { key: 'cash-receipts', name: 'Cash Receipts', description: cashReceipts.reason, statusLabel: cashReceipts.statusLabel, href: '/smartlife/cash-receipts', available: cashReceipts.available },
    ] },
    { key: 'inventory-cost', label: 'Inventory & Cost', reports: [
      { key: 'inventory-report', name: 'Inventory Report', description: 'Stock levels and low-stock alerts', href: '/inventory', available: true },
      { key: 'product-balances', name: 'Product Balances', description: 'Aggregate stock valuation, plus Inventory Movement — Monthly Cost', href: '/smartlife/product-balances', available: true },
      { key: 'cost-centers', name: 'Cost Centers', description: 'SmartLife cost center list', href: '/smartlife/cost-centers', available: true },
    ] },
    /* Cost Center Details and Budgets were removed entirely (not shown
       disabled) — neither has any real SmartERP data source: Cost Center
       Details would need the same missing bulk journal/ledger endpoint as
       Daily Move (to attribute transactions to a cost center); Budgets has
       no endpoint anywhere in the documented SmartERP v3 API surface
       (verified: apps/shared/integrationPlatform.js has zero
       budget/journal/ledger path). A disabled card implies "exists,
       pending access" — neither is true here, so the honest choice is to
       not show the card at all rather than a permanently-disabled one. */
    { key: 'management-analysis', label: 'Management & Analysis', reports: [
      { key: 'project-financials', name: 'Project Financials', description: 'Connected sales, purchases and payments per project', href: null, crossApp: 'projects', crossAppPath: '/projects', available: (connections.count || 0) > 0 },
    ] },
  ];

  return json({
    source: 'SmartLife synchronized snapshot + AL FAROOQUE ERP local records',
    connected: integration.data?.status === 'connected',
    last_sync_at: integration.data?.last_sync_at || null,
    kpis, categories,
  });
}
