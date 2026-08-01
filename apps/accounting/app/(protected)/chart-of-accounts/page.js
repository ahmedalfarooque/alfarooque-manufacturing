'use client';

import { useState } from 'react';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassModal, GlassField, toast, GlassTh, GlassTd } from '@/components/glass';

const TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];

export default function ChartOfAccountsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (typeFilter) params.set('type', typeFilter);
  const { data, refresh } = useLiveData(`/api/chart-of-accounts?${params}`, 0);
  const accounts = data?.accounts || [];

  function openNew() { setForm({}); setEditing(null); setShowForm(true); }
  function openEdit(a) { setForm({ ...a }); setEditing(a.id); setShowForm(true); }

  async function save() {
    setSaving(true);
    try {
      const url = editing ? `/api/chart-of-accounts/${editing}` : '/api/chart-of-accounts';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Save failed');
      toast('Saved', 'success');
      setShowForm(false);
      refresh();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function del(id) {
    if (!confirm('Delete this account?')) return;
    const res = await fetch(`/api/chart-of-accounts/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Deleted', 'success'); refresh(); }
    else toast('Delete failed', 'error');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Chart of Accounts</h1>
        <GlassButton onClick={openNew}>+ Add Account</GlassButton>
      </div>

      <GlassCard>
        <div className="flex gap-3 mb-4">
          <GlassInput placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1" />
          <GlassSelect value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </GlassSelect>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <GlassTh>Code</GlassTh>
              <GlassTh>Name</GlassTh>
              <GlassTh>Type</GlassTh>
              <GlassTh>Category</GlassTh>
              <GlassTh>Active</GlassTh>
              <GlassTh></GlassTh>
            </tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                <GlassTd className="font-mono">{a.account_code}</GlassTd>
                <GlassTd>{a.name}</GlassTd>
                <GlassTd><GlassBadge tone="info">{a.account_type}</GlassBadge></GlassTd>
                <GlassTd className="text-slate-400">{a.category || '—'}</GlassTd>
                <GlassTd><GlassBadge tone={a.is_active ? 'success' : 'error'}>{a.is_active ? 'Yes' : 'No'}</GlassBadge></GlassTd>
                <GlassTd>
                  <div className="flex gap-2">
                    <GlassButton variant="secondary" size="sm" onClick={() => openEdit(a)}>Edit</GlassButton>
                    <GlassButton variant="danger" size="sm" onClick={() => del(a.id)}>Del</GlassButton>
                  </div>
                </GlassTd>
              </tr>
            ))}
            {!accounts.length && (
              <tr><td colSpan={6} className="text-center text-slate-500 py-8">No accounts found.</td></tr>
            )}
          </tbody>
        </table>
      </GlassCard>

      {showForm && (
        <GlassModal title={editing ? 'Edit Account' : 'New Account'} onClose={() => setShowForm(false)} footer={
          <div className="flex gap-2 justify-end">
            <GlassButton variant="secondary" onClick={() => setShowForm(false)}>Cancel</GlassButton>
            <GlassButton onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</GlassButton>
          </div>
        }>
          <div className="grid grid-cols-2 gap-4">
            <GlassField label="Account Code" required>
              <GlassInput value={form.account_code || ''} onChange={e => setForm(f => ({ ...f, account_code: e.target.value }))} />
            </GlassField>
            <GlassField label="Type" required>
              <GlassSelect value={form.account_type || ''} onChange={e => setForm(f => ({ ...f, account_type: e.target.value }))}>
                <option value="">Select type</option>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </GlassSelect>
            </GlassField>
            <GlassField label="Name (English)" required>
              <GlassInput value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </GlassField>
            <GlassField label="Name (Arabic)">
              <GlassInput value={form.name_ar || ''} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} dir="rtl" />
            </GlassField>
            <GlassField label="Category">
              <GlassInput value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            </GlassField>
            <GlassField label="Active">
              <GlassSelect value={form.is_active === false ? 'false' : 'true'} onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </GlassSelect>
            </GlassField>
          </div>
        </GlassModal>
      )}
    </div>
  );
}
