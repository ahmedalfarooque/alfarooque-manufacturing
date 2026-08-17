'use client';

import { useMemo, useState } from 'react';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassModal, GlassField, toast, GlassTh, GlassTd } from '@/components/glass';
import { exportReportPdf } from '@/lib/reportPdf';
import DateFilter, { dateFilterLabel } from '@/components/DateFilter';
import { resolveDateRange } from '@/lib/resolveDateRange';
import ListPagination from '@/components/ListPagination';
import { useLanguage } from '@/lib/i18n';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

export default function PaymentsPage() {
  const { t, lang } = useLanguage();
  const [type, setType] = useState('');
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: null, to: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ payment_type: 'receipt', currency: 'SAR' });
  const [saving, setSaving] = useState(false);
  const [reportBusy, setReportBusy] = useState('');
  const { from: dateFrom, to: dateTo } = resolveDateRange(dateFilter);

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (type) p.set('type', type);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    return p;
  }, [page, pageSize, type, dateFrom, dateTo]);
  const { data: paymentsData, refresh } = useLiveData(`/api/payments?${params}`, 15000);
  const { data: bankData } = useLiveData('/api/banking', 0);
  const payments = paymentsData?.payments || [];
  const accounts = bankData?.accounts || [];
  const total = Number(paymentsData?.total) || 0;

  /* Same shared A4 report engine as the rest of Accounting. Walks every
     server page (500 at a time) under the active type/date filters instead
     of only exporting the currently visible page. */
  async function fetchAllPayments() {
    const all = [];
    for (let p = 1, guard = 0; guard < 100; guard += 1) {
      const qp = new URLSearchParams(params); qp.set('page', String(p)); qp.set('pageSize', '500');
      const res = await fetch(`/api/payments?${qp}`, { credentials: 'same-origin' });
      const body = await res.json().catch(() => ({}));
      const batch = Array.isArray(body.payments) ? body.payments : [];
      all.push(...batch);
      if (!batch.length || batch.length < 500 || all.length >= Number(body.total || 0)) break;
      p += 1;
    }
    return all;
  }

  async function runReport(action) {
    setReportBusy(action);
    try {
      const all = await fetchAllPayments();
      await exportReportPdf({
        title: 'Payments Report' + (type ? ` — ${type === 'receipt' ? 'Receipts' : 'Payments'}` : '') + (dateFilter.preset !== 'all' ? ` — Period: ${dateFilterLabel(dateFilter, t, lang)}` : ''),
        columns: [
          { key: 'payment_type', header: 'Type' }, { key: 'payment_date', header: 'Date' },
          { key: 'party_name', header: 'Party' }, { key: 'bankAccountName', header: 'Bank Account' },
          { key: 'amountText', header: 'Amount' }, { key: 'reference', header: 'Reference' },
        ],
        rows: all.map(p => ({ ...p, party_name: p.party_name || '—', bankAccountName: p.acc_bank_accounts?.name || '—', amountText: `SAR ${fmt(p.amount)}`, reference: p.reference || '—' })),
        totals: [['Payments exported', String(all.length)], ['Total amount', `SAR ${fmt(all.reduce((s, p) => s + Number(p.amount || 0), 0))}`]],
        fileName: 'payments-report.pdf', action,
      });
    } catch (e) { toast(e.message || 'Could not generate report.', 'error'); }
    finally { setReportBusy(''); }
  }

  async function createPayment() {
    setSaving(true);
    try {
      const res = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to create payment');
      toast('Payment recorded', 'success');
      setShowForm(false);
      setForm({ payment_type: 'receipt', currency: 'SAR' });
      refresh();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function del(id) {
    if (!confirm('Delete this payment?')) return;
    const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Deleted', 'success'); refresh(); }
    else toast('Delete failed', 'error');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Payments</h1>
        <GlassButton onClick={() => setShowForm(true)}>+ Record Payment</GlassButton>
      </div>

      <GlassCard>
        <div className="flex gap-3 mb-4">
          <GlassSelect value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            <option value="receipt">Receipts</option>
            <option value="payment">Payments</option>
          </GlassSelect>
          <DateFilter value={dateFilter} onChange={v => { setDateFilter(v); setPage(1); }} t={t} lang={lang} />
          <GlassButton variant="secondary" onClick={() => runReport('print')} disabled={!total || !!reportBusy}>{reportBusy === 'print' ? 'Preparing…' : 'Print'}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runReport('save')} disabled={!total || !!reportBusy}>{reportBusy === 'save' ? 'Generating…' : 'Download PDF'}</GlassButton>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <GlassTh>Type</GlassTh>
              <GlassTh>Date</GlassTh>
              <GlassTh>Party</GlassTh>
              <GlassTh>Bank Account</GlassTh>
              <GlassTh>Amount</GlassTh>
              <GlassTh>Reference</GlassTh>
              <GlassTh></GlassTh>
            </tr>
          </thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                <GlassTd><GlassBadge tone={p.payment_type === 'receipt' ? 'success' : 'warning'}>{p.payment_type}</GlassBadge></GlassTd>
                <GlassTd>{p.payment_date}</GlassTd>
                <GlassTd>{p.party_name || '—'}</GlassTd>
                <GlassTd className="text-slate-400">{p.acc_bank_accounts?.name || '—'}</GlassTd>
                <GlassTd className="font-medium text-white">SAR {fmt(p.amount)}</GlassTd>
                <GlassTd className="text-slate-400 font-mono text-xs">{p.reference || '—'}</GlassTd>
                <GlassTd>
                  <GlassButton variant="danger" size="sm" onClick={() => del(p.id)}>Del</GlassButton>
                </GlassTd>
              </tr>
            ))}
            {!payments.length && (
              <tr><td colSpan={7} className="text-center text-slate-500 py-8">No payments found.</td></tr>
            )}
          </tbody>
        </table>

        <ListPagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={v => { setPageSize(v); setPage(1); }} label="payments" />
      </GlassCard>

      {showForm && (
        <GlassModal title="Record Payment" onClose={() => setShowForm(false)} footer={
          <div className="flex gap-2 justify-end">
            <GlassButton variant="secondary" onClick={() => setShowForm(false)}>Cancel</GlassButton>
            <GlassButton onClick={createPayment} disabled={saving}>{saving ? 'Saving…' : 'Save'}</GlassButton>
          </div>
        }>
          <div className="grid grid-cols-2 gap-4">
            <GlassField label="Type" required>
              <GlassSelect value={form.payment_type || 'receipt'} onChange={e => setForm(f => ({ ...f, payment_type: e.target.value }))}>
                <option value="receipt">Receipt (from customer)</option>
                <option value="payment">Payment (to vendor)</option>
              </GlassSelect>
            </GlassField>
            <GlassField label="Date">
              <GlassInput type="date" value={form.payment_date || ''} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
            </GlassField>
            <GlassField label="Amount" required>
              <GlassInput type="number" step="0.01" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </GlassField>
            <GlassField label="Currency">
              <GlassSelect value={form.currency || 'SAR'} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option>SAR</option><option>USD</option><option>EUR</option><option>AED</option>
              </GlassSelect>
            </GlassField>
            <GlassField label="Bank Account" required>
              <GlassSelect value={form.bank_account_id || ''} onChange={e => setForm(f => ({ ...f, bank_account_id: e.target.value }))}>
                <option value="">Select account</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </GlassSelect>
            </GlassField>
            <GlassField label="Party Name">
              <GlassInput value={form.party_name || ''} onChange={e => setForm(f => ({ ...f, party_name: e.target.value }))} />
            </GlassField>
            <GlassField label="Reference">
              <GlassInput value={form.reference || ''} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
            </GlassField>
            <GlassField label="Notes">
              <GlassInput value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </GlassField>
          </div>
        </GlassModal>
      )}
    </div>
  );
}
