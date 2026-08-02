'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'summary';
  const from = url.searchParams.get('from') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to = url.searchParams.get('to') || new Date().toISOString().slice(0, 10);

  const sb = getDb();

  if (type === 'income_statement') {
    const [invoices, bills, expenses] = await Promise.all([
      sb.from('acc_invoices').select('total_amount, status').in('status', ['Sent', 'Paid', 'Partially Paid']).gte('invoice_date', from).lte('invoice_date', to),
      sb.from('acc_bills').select('total_amount, status').in('status', ['Unpaid', 'Paid', 'Partially Paid']).gte('bill_date', from).lte('bill_date', to),
      sb.from('acc_expenses').select('amount, category').eq('status', 'Approved').gte('expense_date', from).lte('expense_date', to),
    ]);
    const revenue = (invoices.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const cogs = (bills.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const opex = (expenses.data || []).reduce((s, r) => s + Number(r.amount || 0), 0);
    return json({ type, from, to, revenue, cogs, gross_profit: revenue - cogs, opex, net_income: revenue - cogs - opex });
  }

  if (type === 'balance_sheet') {
    const [bankAccounts, invoices, bills, assets] = await Promise.all([
      sb.from('acc_bank_accounts').select('current_balance').eq('is_active', true),
      sb.from('acc_invoices').select('total_amount').in('status', ['Sent', 'Partially Paid']),
      sb.from('acc_bills').select('total_amount').in('status', ['Unpaid', 'Partially Paid']),
      sb.from('acc_assets').select('current_book_value').eq('status', 'Active'),
    ]);
    const cash = (bankAccounts.data || []).reduce((s, r) => s + Number(r.current_balance || 0), 0);
    const receivables = (invoices.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const fixedAssets = (assets.data || []).reduce((s, r) => s + Number(r.current_book_value || 0), 0);
    const payables = (bills.data || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const totalAssets = cash + receivables + fixedAssets;
    return json({ type, cash, receivables, fixed_assets: fixedAssets, total_assets: totalAssets, payables, equity: totalAssets - payables });
  }

  if (type === 'cash_flow') {
    const [payments] = await Promise.all([
      sb.from('acc_bank_transactions').select('transaction_type, amount').gte('transaction_date', from).lte('transaction_date', to),
    ]);
    const inflows = (payments.data || []).filter(t => t.transaction_type === 'credit').reduce((s, r) => s + Number(r.amount || 0), 0);
    const outflows = (payments.data || []).filter(t => t.transaction_type === 'debit').reduce((s, r) => s + Number(r.amount || 0), 0);
    return json({ type, from, to, inflows, outflows, net_cash_flow: inflows - outflows });
  }

  if (type === 'vat') {
    const [invoices, bills] = await Promise.all([
      sb.from('acc_invoices').select('tax_amount, total_amount, status').in('status', ['Sent', 'Paid']).gte('invoice_date', from).lte('invoice_date', to),
      sb.from('acc_bills').select('tax_amount, total_amount, status').in('status', ['Paid']).gte('bill_date', from).lte('bill_date', to),
    ]);
    const outputVat = (invoices.data || []).reduce((s, r) => s + Number(r.tax_amount || 0), 0);
    const inputVat = (bills.data || []).reduce((s, r) => s + Number(r.tax_amount || 0), 0);
    return json({ type, from, to, output_vat: outputVat, input_vat: inputVat, net_vat_payable: outputVat - inputVat });
  }

  /* Reads inv_stock/inv_products/inv_materials directly (same Supabase
     project) — Inventory remains the sole source of stock quantities and
     cost; this report only aggregates what's already there. */
  if (type === 'inventory_valuation') {
    const { data: stock, error } = await sb.from('inv_stock')
      .select('qty_on_hand, avg_cost, inv_warehouses(name), inv_products(name, sku), inv_materials(name, material_code)')
      .gt('qty_on_hand', 0);
    if (error) return json({ error: 'Could not load inventory valuation.' }, 500);

    const byWarehouse = {};
    let totalValue = 0;
    const lines = (stock || []).map(row => {
      const qty = Number(row.qty_on_hand || 0);
      const cost = Number(row.avg_cost || 0);
      const value = qty * cost;
      totalValue += value;
      const wh = row.inv_warehouses?.name || 'Unassigned';
      byWarehouse[wh] = (byWarehouse[wh] || 0) + value;
      return {
        name: row.inv_products?.name || row.inv_materials?.name || '—',
        code: row.inv_products?.sku || row.inv_materials?.material_code || '—',
        warehouse: wh, qty, avg_cost: cost, value,
      };
    }).sort((a, b) => b.value - a.value);

    return json({ type, total_value: totalValue, by_warehouse: byWarehouse, lines: lines.slice(0, 200) });
  }

  /* Reads pm_projects directly (same Supabase project) to attach project
     names to acc_bills/acc_expenses/acc_invoices that were tagged with a
     project_id — the cross-app link the Purchasing "Running Project"
     destination and manual project tagging both rely on. */
  if (type === 'project_costing') {
    const [bills, expenses, invoices, projects] = await Promise.all([
      sb.from('acc_bills').select('project_id, total_amount').not('project_id', 'is', null).gte('bill_date', from).lte('bill_date', to),
      sb.from('acc_expenses').select('project_id, amount').not('project_id', 'is', null).eq('status', 'Approved').gte('expense_date', from).lte('expense_date', to),
      sb.from('acc_invoices').select('project_id, total_amount').not('project_id', 'is', null).gte('invoice_date', from).lte('invoice_date', to),
      sb.from('pm_projects').select('id, project_name, customer_name'),
    ]);
    const projectNames = {};
    (projects.data || []).forEach(p => { projectNames[p.id] = p.project_name; });

    const byProject = {};
    function addCost(projectId, amount) {
      if (!byProject[projectId]) byProject[projectId] = { project_id: projectId, project_name: projectNames[projectId] || 'Unknown Project', cost: 0, revenue: 0 };
      byProject[projectId].cost += amount;
    }
    function addRevenue(projectId, amount) {
      if (!byProject[projectId]) byProject[projectId] = { project_id: projectId, project_name: projectNames[projectId] || 'Unknown Project', cost: 0, revenue: 0 };
      byProject[projectId].revenue += amount;
    }
    (bills.data || []).forEach(b => addCost(b.project_id, Number(b.total_amount || 0)));
    (expenses.data || []).forEach(e => addCost(e.project_id, Number(e.amount || 0)));
    (invoices.data || []).forEach(i => addRevenue(i.project_id, Number(i.total_amount || 0)));

    const rows = Object.values(byProject).map(p => ({ ...p, margin: p.revenue - p.cost })).sort((a, b) => b.cost - a.cost);
    return json({ type, from, to, projects: rows });
  }

  const [invoiceCount, billCount, expenseTotal, journalCount, bankBalance] = await Promise.all([
    sb.from('acc_invoices').select('id', { count: 'exact', head: true }),
    sb.from('acc_bills').select('id', { count: 'exact', head: true }),
    sb.from('acc_expenses').select('amount').eq('status', 'Approved'),
    sb.from('acc_journal_entries').select('id', { count: 'exact', head: true }).eq('status', 'Posted'),
    sb.from('acc_bank_accounts').select('current_balance').eq('is_active', true),
  ]);
  return json({
    type: 'summary',
    total_invoices: invoiceCount.count || 0,
    total_bills: billCount.count || 0,
    total_expenses: (expenseTotal.data || []).reduce((s, r) => s + Number(r.amount || 0), 0),
    total_journal_entries: journalCount.count || 0,
    total_bank_balance: (bankBalance.data || []).reduce((s, r) => s + Number(r.current_balance || 0), 0),
  });
}
