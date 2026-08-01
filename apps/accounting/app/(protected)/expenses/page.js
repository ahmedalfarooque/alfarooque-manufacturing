'use client';

import { useState } from 'react';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassPagination, GlassModal, GlassField, GlassTextarea, toast, GlassTh, GlassTd } from '@/components/glass';

const CATEGORIES = ['General', 'Travel', 'Meals', 'Office Supplies', 'Utilities', 'Rent', 'Insurance', 'Marketing', 'Maintenance', 'Other'];
const STATUSES = ['Pending', 'Approved', 'Rejected', 'Paid'];
function statusTone(s) { return s === 'Approved' ? 'info' : s === 'Paid' ? 'success' : s === 'Rejected' ? 'error' : 'neutral'; }
function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

export default function ExpensesPage() {
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ currency: 'SAR', category: 'General' });
  const [saving, setSaving] = useState(false);
  const pageSize = 25;

  const params = new URLSearchParams({ page, pageSize });
  if (category) params.set('category', category);
  const { data, refresh } = useLiveData(`/api/expenses?${params}`, 15000);
  const expenses = data?.expenses || [];

  async function createExpense() {
    setSaving(true);
    try {
      const res = await fetch('/api/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed');
      toast('Expense created', 'success');
      setShowForm(false);
      setForm({ currency: 'SAR', category: 'General' });
      refresh();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function updateStatus(id, status) {
    const res = await fetch(`/api/expenses/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) { toast('Updated', 'success'); refresh(); }
    else toast('Update failed', 'error');
  }

  async function del(id) {
    if (!confirm('Delete this expense?')) return;
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Deleted', 'success'); refresh(); }
    else toast('Delete failed', 'error');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Expenses</h1>
        <GlassButton onClick={() => setShowForm(true)}>+ New Expense</GlassButton>
      </div>

      <GlassCard>
        <div className="flex gap-3 mb-4">
          <GlassSelect value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </GlassSelect>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <GlassTh>Date</GlassTh>
              <GlassTh>Description</GlassTh>
              <GlassTh>Category</GlassTh>
              <GlassTh>Vendor</GlassTh>
              <GlassTh>Amount</GlassTh>
              <GlassTh>Status</GlassTh>
              <GlassTh></GlassTh>
            </tr>
          </thead>
          <tbody>
            {expenses.map(e => (
              <tr key={e.id} className="border-b border-white/5 hover:bg-white/5">
                <GlassTd>{e.expense_date}</GlassTd>
                <GlassTd>{e.description}</GlassTd>
                <GlassTd><GlassBadge tone="neutral">{e.category}</GlassBadge></GlassTd>
                <GlassTd className="text-slate-400">{e.vendor_name || '—'}</GlassTd>
                <GlassTd>SAR {fmt(e.amount)}</GlassTd>
                <GlassTd><GlassBadge tone={statusTone(e.status)}>{e.status}</GlassBadge></GlassTd>
                <GlassTd>
                  <div className="flex gap-1">
                    {e.status === 'Pending' && <GlassButton variant="secondary" size="sm" onClick={() => updateStatus(e.id, 'Approved')}>Approve</GlassButton>}
                    {e.status === 'Approved' && <GlassButton variant="secondary" size="sm" onClick={() => updateStatus(e.id, 'Paid')}>Mark Paid</GlassButton>}
                    <GlassButton variant="danger" size="sm" onClick={() => del(e.id)}>Del</GlassButton>
                  </div>
                </GlassTd>
              </tr>
            ))}
            {!expenses.length && (
              <tr><td colSpan={7} className="text-center text-slate-500 py-8">No expenses found.</td></tr>
            )}
          </tbody>
        </table>

        <GlassPagination page={page} pageSize={pageSize} total={data?.total || 0} onPage={setPage} />
      </GlassCard>

      {showForm && (
        <GlassModal title="New Expense" onClose={() => setShowForm(false)} footer={
          <div className="flex gap-2 justify-end">
            <GlassButton variant="secondary" onClick={() => setShowForm(false)}>Cancel</GlassButton>
            <GlassButton onClick={createExpense} disabled={saving}>{saving ? 'Saving…' : 'Save'}</GlassButton>
          </div>
        }>
          <div className="grid grid-cols-2 gap-4">
            <GlassField label="Description" required>
              <GlassInput value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </GlassField>
            <GlassField label="Category">
              <GlassSelect value={form.category || 'General'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </GlassSelect>
            </GlassField>
            <GlassField label="Date">
              <GlassInput type="date" value={form.expense_date || ''} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} />
            </GlassField>
            <GlassField label="Amount" required>
              <GlassInput type="number" step="0.01" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </GlassField>
            <GlassField label="VAT Amount">
              <GlassInput type="number" step="0.01" value={form.tax_amount || ''} onChange={e => setForm(f => ({ ...f, tax_amount: e.target.value }))} />
            </GlassField>
            <GlassField label="Currency">
              <GlassSelect value={form.currency || 'SAR'} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option>SAR</option><option>USD</option><option>EUR</option><option>AED</option>
              </GlassSelect>
            </GlassField>
            <GlassField label="Vendor Name">
              <GlassInput value={form.vendor_name || ''} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} />
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
