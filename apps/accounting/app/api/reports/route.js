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
