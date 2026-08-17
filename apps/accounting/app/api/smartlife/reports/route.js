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
const { readAllSmartLife } = require('../../../../../shared/integrationPlatform');

function r2(value) { return Math.round((Number(value) || 0) * 100) / 100; }
function first(record, keys) { for (const k of keys) if (record?.[k] != null && record[k] !== '') return record[k]; return null; }

export async function GET(req) {
  const { response } = await requireAction(req, 'view'); if (response) return response;
  const sb = getDb();
  /* KPI totals are computed LIVE against the full real dataset (same
     readAllSmartLife() the Dashboard API uses) rather than the local
     erp_financial_source_records snapshot — that snapshot can be stale
     relative to the live account and previously produced a DIFFERENT
     "Total Purchases" figure than the Dashboard for the same real data,
     which is exactly the kind of inconsistency this fix removes. */
  const [salesResult, purchasesResult, payments, connections, integration] = await Promise.all([
    readAllSmartLife(sb, 'sales-invoices', { limit: '500' }, { maxPages: 20 }).catch(() => ({ records: [] })),
    readAllSmartLife(sb, 'purchases', { limit: '500' }, { maxPages: 20 }).catch(() => ({ records: [] })),
    sb.from('erp_project_payments').select('direction,amount,origin'),
    sb.from('erp_financial_connections').select('id', { count: 'exact', head: true }),
    sb.from('crm_integrations').select('status,last_sync_at,last_error').eq('tenant_id', 'alfarooque').eq('integration_key', 'smartlife').maybeSingle(),
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
  const localPayments = payments.data || [];

  const hasSales = sales.length > 0;
  const hasPurchases = purchases.length > 0;

  const kpis = {
    totalSales: hasSales ? r2(sum(sales, 'total_amount')) : null,
    totalPurchases: hasPurchases ? r2(sum(purchases, 'total_amount')) : null,
    receivables: hasSales ? r2(sum(sales, 'balance_amount')) : null,
    payables: hasPurchases ? r2(sum(purchases, 'balance_amount')) : null,
    salesVat: hasSales ? r2(sum(sales, 'vat_amount')) : null,
    purchaseVat: hasPurchases ? r2(sum(purchases, 'vat_amount')) : null,
    grossProfit: (hasSales || hasPurchases) ? r2(sum(sales, 'total_amount') - sum(purchases, 'total_amount')) : null,
    localPaymentsReceived: r2(sum(localPayments.filter(p => p.direction === 'received'), 'amount')),
    localPaymentsMade: r2(sum(localPayments.filter(p => p.direction === 'made'), 'amount')),
    connectedRecords: connections.count || 0,
  };
  kpis.netVat = (kpis.salesVat != null && kpis.purchaseVat != null) ? r2(kpis.salesVat - kpis.purchaseVat) : null;

  /* Report catalog — grouped by business category, each entry says exactly
     what's available. `href` points at the existing dedicated workspace
     where one already exists (no duplicate report UI); `unavailable`
     entries are real gaps (no GL/ledger source), never faked. */
  const categories = [
    { key: 'sales', label: 'Sales & Revenue', reports: [
      { key: 'sales-report', name: 'Sales Report', description: 'Revenue and sales activity', href: '/smartlife/sales-invoices', available: hasSales },
      { key: 'sales-by-customer', name: 'Sales by Customer', description: 'Revenue grouped by customer', href: '/smartlife/sales-invoices', available: hasSales },
    ] },
    { key: 'purchasing', label: 'Purchasing', reports: [
      { key: 'purchase-report', name: 'Purchase Report', description: 'Purchasing activity and cost', href: '/smartlife/purchases', available: hasPurchases },
      { key: 'purchase-by-supplier', name: 'Purchases by Supplier', description: 'Purchasing grouped by supplier', href: '/smartlife/purchases', available: hasPurchases },
    ] },
    { key: 'receivables-payables', label: 'Receivables & Payables', reports: [
      { key: 'receivables', name: 'Receivables', description: 'Outstanding customer balances', href: '/smartlife/sales-invoices', available: hasSales },
      { key: 'payables', name: 'Payables', description: 'Outstanding supplier balances', href: '/smartlife/purchases', available: hasPurchases },
    ] },
    { key: 'vat', label: 'VAT / Tax', reports: [
      { key: 'vat-summary', name: 'VAT Summary & Report', description: 'Sales, Sales VAT, Purchases, Purchase VAT, and Net VAT by period', href: '/vat', available: hasSales || hasPurchases },
      { key: 'tax-rates', name: 'Tax Rates', description: 'Configured tax rates', href: '/smartlife/tax', available: true },
    ] },
    { key: 'projects', label: 'Projects', reports: [
      { key: 'project-financials', name: 'Project Financials', description: 'Connected sales, purchases and payments per project', href: null, crossApp: 'projects', crossAppPath: '/projects', available: (connections.count || 0) > 0 },
    ] },
    { key: 'profitability', label: 'Profitability', reports: [
      { key: 'gross-profit', name: 'Gross Profit', description: 'Sales revenue minus actual purchase cost', href: null, available: hasSales || hasPurchases },
    ] },
    { key: 'general-accounting', label: 'General Accounting', reports: [
      { key: 'accounts', name: 'Accounts', description: 'SmartLife Chart of Accounts', href: '/smartlife/accounts', available: true },
      { key: 'account-balances', name: 'Account Balances', description: 'Current balance per account', href: '/smartlife/account-balances', available: true },
      { key: 'trial-balance', name: 'Trial Balance', description: 'Not available from SmartLife.', href: null, available: false },
      { key: 'income-statement', name: 'Income Statement', description: 'Not available from SmartLife.', href: null, available: false },
      { key: 'financial-position', name: 'Financial Position', description: 'Not available from SmartLife.', href: null, available: false },
      { key: 'cash-flow', name: 'Cash Flow Statement', description: 'Not available from SmartLife.', href: null, available: false },
    ] },
    { key: 'transactions', label: 'Transactions', reports: [
      { key: 'daily-move', name: 'Daily Move', description: 'Not available from SmartLife.', href: null, available: false },
      { key: 'receipts', name: 'Receipts', description: 'Not available from SmartLife.', href: null, available: false },
      { key: 'cash-receipts', name: 'Cash Receipts', description: 'Not available from SmartLife.', href: null, available: false },
    ] },
    { key: 'inventory-products', label: 'Inventory / Products', reports: [
      { key: 'inventory-report', name: 'Inventory Report', description: 'Stock levels and low-stock alerts', href: '/inventory', available: true },
      { key: 'product-balances', name: 'Product Balances', description: 'Aggregate stock valuation, plus Inventory Movement — Monthly Cost', href: '/smartlife/product-balances', available: true },
    ] },
    { key: 'management', label: 'Management', reports: [
      { key: 'cost-centers', name: 'Cost Centers', description: 'SmartLife cost center list', href: '/smartlife/cost-centers', available: true },
      { key: 'cost-center-details', name: 'Cost Center Details', description: 'Not available from SmartLife.', href: null, available: false },
      { key: 'budgets', name: 'Budgets', description: 'Not available from SmartLife.', href: null, available: false },
    ] },
  ];

  return json({
    source: 'SmartLife synchronized snapshot + AL FAROOQUE ERP local records',
    connected: integration.data?.status === 'connected',
    last_sync_at: integration.data?.last_sync_at || null,
    kpis, categories,
  });
}
