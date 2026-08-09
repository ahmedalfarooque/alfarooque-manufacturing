'use client';

import { useState } from 'react';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassPagination, GlassModal, GlassField, toast, GlassTh, GlassTd } from '@/components/glass';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

export default function PaymentsPage() {
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ payment_type: 'receipt', currency: 'SAR' });
  const [saving, setSaving] = useState(false);
  const pageSize = 25;

  const params = new URLSearchParams({ page, pageSize });
  if (type) params.set('type', type);
  const { data: paymentsData, refresh } = useLiveData(`/api/payments?${params}`, 15000);
  const { data: bankData } = useLiveData('/api/banking', 0);
  const payments = paymentsData?.payments || [];
  const accounts = bankData?.accounts || [];

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

        <GlassPagination page={page} pageSize={pageSize} total={paymentsData?.total || 0} onPage={setPage} />
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
