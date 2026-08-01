'use client';

import { useState } from 'react';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassPagination, GlassModal, GlassField, toast, GlassTh, GlassTd } from '@/components/glass';

const STATUSES = ['Draft', 'Unpaid', 'Paid', 'Overdue', 'Cancelled', 'Partially Paid'];
function statusTone(s) { return s === 'Paid' ? 'success' : s === 'Overdue' ? 'error' : s === 'Unpaid' ? 'warning' : 'neutral'; }
function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

export default function BillsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const pageSize = 25;

  const params = new URLSearchParams({ page, pageSize });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  const { data, refresh } = useLiveData(`/api/bills?${params}`, 15000);
  const bills = data?.bills || [];

  async function createBill() {
    setSaving(true);
    try {
      const res = await fetch('/api/bills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to create bill');
      toast('Bill created', 'success');
      setShowForm(false);
      setForm({});
      refresh();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function updateStatus(id, newStatus) {
    const res = await fetch(`/api/bills/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    if (res.ok) { toast('Status updated', 'success'); refresh(); }
    else toast('Update failed', 'error');
  }

  async function del(id) {
    if (!confirm('Delete this bill?')) return;
    const res = await fetch(`/api/bills/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Deleted', 'success'); refresh(); }
    else toast('Delete failed', 'error');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Bills (Accounts Payable)</h1>
        <GlassButton onClick={() => setShowForm(true)}>+ New Bill</GlassButton>
      </div>

      <GlassCard>
        <div className="flex gap-3 mb-4">
          <GlassInput placeholder="Search number or vendor…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1" />
          <GlassSelect value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </GlassSelect>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <GlassTh>Number</GlassTh>
              <GlassTh>Vendor</GlassTh>
              <GlassTh>Date</GlassTh>
              <GlassTh>Due</GlassTh>
              <GlassTh>Total</GlassTh>
              <GlassTh>Status</GlassTh>
              <GlassTh></GlassTh>
            </tr>
          </thead>
          <tbody>
            {bills.map(b => (
              <tr key={b.id} className="border-b border-white/5 hover:bg-white/5">
                <GlassTd className="font-mono">{b.bill_number || b.id.slice(0, 8)}</GlassTd>
                <GlassTd>{b.vendor_name}</GlassTd>
                <GlassTd>{b.bill_date}</GlassTd>
                <GlassTd className="text-slate-400">{b.due_date || '—'}</GlassTd>
                <GlassTd>SAR {fmt(b.total_amount)}</GlassTd>
                <GlassTd><GlassBadge tone={statusTone(b.status)}>{b.status}</GlassBadge></GlassTd>
                <GlassTd>
                  <div className="flex gap-1">
                    {b.status === 'Draft' && <GlassButton variant="secondary" size="sm" onClick={() => updateStatus(b.id, 'Unpaid')}>Approve</GlassButton>}
                    {b.status === 'Unpaid' && <GlassButton variant="secondary" size="sm" onClick={() => updateStatus(b.id, 'Paid')}>Mark Paid</GlassButton>}
                    <GlassButton variant="danger" size="sm" onClick={() => del(b.id)}>Del</GlassButton>
                  </div>
                </GlassTd>
              </tr>
            ))}
            {!bills.length && (
              <tr><td colSpan={7} className="text-center text-slate-500 py-8">No bills found.</td></tr>
            )}
          </tbody>
        </table>

        <GlassPagination page={page} pageSize={pageSize} total={data?.total || 0} onPage={setPage} />
      </GlassCard>

      {showForm && (
        <GlassModal title="New Bill" onClose={() => setShowForm(false)} footer={
          <div className="flex gap-2 justify-end">
            <GlassButton variant="secondary" onClick={() => setShowForm(false)}>Cancel</GlassButton>
            <GlassButton onClick={createBill} disabled={saving}>{saving ? 'Creating…' : 'Create'}</GlassButton>
          </div>
        }>
          <div className="grid grid-cols-2 gap-4">
            <GlassField label="Vendor Name" required>
              <GlassInput value={form.vendor_name || ''} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} />
            </GlassField>
            <GlassField label="Vendor Email">
              <GlassInput type="email" value={form.vendor_email || ''} onChange={e => setForm(f => ({ ...f, vendor_email: e.target.value }))} />
            </GlassField>
            <GlassField label="Bill Date">
              <GlassInput type="date" value={form.bill_date || ''} onChange={e => setForm(f => ({ ...f, bill_date: e.target.value }))} />
            </GlassField>
            <GlassField label="Due Date">
              <GlassInput type="date" value={form.due_date || ''} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </GlassField>
            <GlassField label="Subtotal">
              <GlassInput type="number" step="0.01" value={form.subtotal || ''} onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))} />
            </GlassField>
            <GlassField label="VAT Amount">
              <GlassInput type="number" step="0.01" value={form.tax_amount || ''} onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))} />
            </GlassField>
            <GlassField label="Total Amount">
              <GlassInput type="number" step="0.01" value={form.total_amount || ''} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))} />
            </GlassField>
            <GlassField label="Currency">
              <GlassSelect value={form.currency || 'SAR'} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option>SAR</option><option>USD</option><option>EUR</option><option>AED</option>
              </GlassSelect>
            </GlassField>
          </div>
        </GlassModal>
      )}
    </div>
  );
}
