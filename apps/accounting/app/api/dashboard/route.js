'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const sb = getDb();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const [
    { data: invoices },
    { data: bills },
    { data: bankAccounts },
    { count: monthJournals },
    { data: monthExpenses },
    { data: recentInvoices },
    { data: recentBills },
  ] = await Promise.all([
    sb.from('acc_invoices').select('total_amount, status, due_date').in('status', ['Sent', 'Partially Paid', 'Overdue']),
    sb.from('acc_bills').select('total_amount, status, due_date').in('status', ['Unpaid', 'Partially Paid', 'Overdue']),
    sb.from('acc_bank_accounts').select('current_balance, currency').eq('is_active', true),
    sb.from('acc_journal_entries').select('id', { count: 'exact', head: true }).gte('entry_date', monthStart),
    sb.from('acc_expenses').select('amount').gte('expense_date', monthStart).eq('status', 'Approved'),
    sb.from('acc_invoices').select('id, invoice_number, customer_name, total_amount, status, due_date').order('created_at', { ascending: false }).limit(5),
    sb.from('acc_bills').select('id, bill_number, vendor_name, total_amount, status, due_date').order('created_at', { ascending: false }).limit(5),
  ]);

  const totalReceivable = (invoices || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const totalPayable = (bills || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const cashBalance = (bankAccounts || []).reduce((s, r) => s + Number(r.current_balance || 0), 0);
  const monthExpensesTotal = (monthExpenses || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const today = now.toISOString().slice(0, 10);
  const overdueReceivable = (invoices || []).filter(r => r.due_date && r.due_date < today).reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const overduePayable = (bills || []).filter(r => r.due_date && r.due_date < today).reduce((s, r) => s + Number(r.total_amount || 0), 0);

  let dashboardReceivable = totalReceivable;
  let dashboardInvoices = recentInvoices || [];
  if (!dashboardInvoices.length) {
    const { data: legacyOrders } = await sb.from('orders')
      .select('id, order_no, guest_name, grand_total, payment_status, status, created_at')
      .eq('is_deleted', false).order('created_at', { ascending: false }).limit(5);
    dashboardInvoices = (legacyOrders || []).map(row => ({ ...row, invoice_number: row.order_no, customer_name: row.guest_name, total_amount: row.grand_total, status: row.payment_status || row.status, source_table: 'orders' }));
    dashboardReceivable = dashboardInvoices.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  }

  return json({
    totalReceivable: dashboardReceivable, totalPayable, cashBalance,
    monthJournalCount: monthJournals || 0,
    monthExpenses: monthExpensesTotal, overdueReceivable, overduePayable,
    recentInvoices: dashboardInvoices,
    recentBills: recentBills || [],
  });
}
