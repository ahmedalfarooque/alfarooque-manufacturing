'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
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
    sb.from('acc_invoices').select('total_amount, status').eq('status', 'Sent'),
    sb.from('acc_bills').select('total_amount, status').eq('status', 'Unpaid'),
    sb.from('acc_bank_accounts').select('current_balance, currency').eq('is_active', true),
    sb.from('acc_journal_entries').select('id', { count: 'exact', head: true }).gte('entry_date', monthStart),
    sb.from('acc_expense_claims').select('total_amount').gte('claim_date', monthStart).eq('status', 'Approved'),
    sb.from('acc_invoices').select('id, invoice_number, customer_name, total_amount, status, due_date').order('created_at', { ascending: false }).limit(5),
    sb.from('acc_bills').select('id, bill_number, vendor_name, total_amount, status, due_date').order('created_at', { ascending: false }).limit(5),
  ]);

  const totalReceivable = (invoices || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const totalPayable = (bills || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const cashBalance = (bankAccounts || []).reduce((s, r) => s + Number(r.current_balance || 0), 0);
  const monthExpensesTotal = (monthExpenses || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);

  return json({
    totalReceivable, totalPayable, cashBalance,
    monthJournalCount: monthJournals || 0,
    monthExpenses: monthExpensesTotal,
    recentInvoices: recentInvoices || [],
    recentBills: recentBills || [],
  });
}
