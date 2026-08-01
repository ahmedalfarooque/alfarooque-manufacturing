'use client';

import { useState } from 'react';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassPagination, GlassModal, GlassField, toast, GlassTh, GlassTd } from '@/components/glass';

const CATEGORIES = ['Equipment', 'Machinery', 'Vehicles', 'Furniture', 'Land', 'Buildings', 'Computers', 'Other'];
const STATUSES = ['Active', 'Disposed', 'Under Maintenance', 'Fully Depreciated'];
function statusTone(s) { return s === 'Active' ? 'success' : s === 'Disposed' ? 'error' : s === 'Under Maintenance' ? 'warning' : 'neutral'; }
function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

export default function AssetsPage() {
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: 'Equipment', useful_life_years: 5, depreciation_method: 'straight_line' });
  const [saving, setSaving] = useState(false);
  const pageSize = 25;

  const params = new URLSearchParams({ page, pageSize });
  if (category) params.set('category', category);
  const { data, refresh } = useLiveData(`/api/assets?${params}`, 0);
  const assets = data?.assets || [];

  async function createAsset() {
    setSaving(true);
    try {
      const res = await fetch('/api/assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed');
      toast('Asset added', 'success');
      setShowForm(false);
      setForm({ category: 'Equipment', useful_life_years: 5, depreciation_method: 'straight_line' });
      refresh();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function updateStatus(id, status) {
    const res = await fetch(`/api/assets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    if (res.ok) { toast('Updated', 'success'); refresh(); }
    else toast('Update failed', 'error');
  }

  async function del(id) {
    if (!confirm('Delete this asset?')) return;
    const res = await fetch(`/api/assets/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Deleted', 'success'); refresh(); }
    else toast('Delete failed', 'error');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Fixed Assets</h1>
        <GlassButton onClick={() => setShowForm(true)}>+ Add Asset</GlassButton>
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
              <GlassTh>Name</GlassTh>
              <GlassTh>Category</GlassTh>
              <GlassTh>Purchase Date</GlassTh>
              <GlassTh>Cost</GlassTh>
              <GlassTh>Book Value</GlassTh>
              <GlassTh>Status</GlassTh>
              <GlassTh></GlassTh>
            </tr>
          </thead>
          <tbody>
            {assets.map(a => (
              <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                <GlassTd>
                  <p className="text-white font-medium">{a.name}</p>
                  {a.serial_number && <p className="text-xs text-slate-500">SN: {a.serial_number}</p>}
                </GlassTd>
                <GlassTd><GlassBadge tone="neutral">{a.category}</GlassBadge></GlassTd>
                <GlassTd>{a.purchase_date}</GlassTd>
                <GlassTd>SAR {fmt(a.purchase_cost)}</GlassTd>
                <GlassTd className="text-cyan-400">SAR {fmt(a.current_book_value)}</GlassTd>
                <GlassTd><GlassBadge tone={statusTone(a.status)}>{a.status}</GlassBadge></GlassTd>
                <GlassTd>
                  <div className="flex gap-1">
                    {a.status === 'Active' && <GlassButton variant="secondary" size="sm" onClick={() => updateStatus(a.id, 'Disposed')}>Dispose</GlassButton>}
                    <GlassButton variant="danger" size="sm" onClick={() => del(a.id)}>Del</GlassButton>
                  </div>
                </GlassTd>
              </tr>
            ))}
            {!assets.length && (
              <tr><td colSpan={7} className="text-center text-slate-500 py-8">No assets found.</td></tr>
            )}
          </tbody>
        </table>

        <GlassPagination page={page} pageSize={pageSize} total={data?.total || 0} onPage={setPage} />
      </GlassCard>

      {showForm && (
        <GlassModal title="Add Fixed Asset" onClose={() => setShowForm(false)} footer={
          <div className="flex gap-2 justify-end">
            <GlassButton variant="secondary" onClick={() => setShowForm(false)}>Cancel</GlassButton>
            <GlassButton onClick={createAsset} disabled={saving}>{saving ? 'Saving…' : 'Save'}</GlassButton>
          </div>
        }>
          <div className="grid grid-cols-2 gap-4">
            <GlassField label="Asset Name" required>
              <GlassInput value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </GlassField>
            <GlassField label="Category">
              <GlassSelect value={form.category || 'Equipment'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </GlassSelect>
            </GlassField>
            <GlassField label="Purchase Date">
              <GlassInput type="date" value={form.purchase_date || ''} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
            </GlassField>
            <GlassField label="Purchase Cost" required>
              <GlassInput type="number" step="0.01" value={form.purchase_cost || ''} onChange={e => setForm(f => ({ ...f, purchase_cost: e.target.value }))} />
            </GlassField>
            <GlassField label="Salvage Value">
              <GlassInput type="number" step="0.01" value={form.salvage_value || ''} onChange={e => setForm(f => ({ ...f, salvage_value: e.target.value }))} />
            </GlassField>
            <GlassField label="Useful Life (Years)">
              <GlassInput type="number" value={form.useful_life_years || 5} onChange={e => setForm(f => ({ ...f, useful_life_years: e.target.value }))} />
            </GlassField>
            <GlassField label="Depreciation Method">
              <GlassSelect value={form.depreciation_method || 'straight_line'} onChange={e => setForm(f => ({ ...f, depreciation_method: e.target.value }))}>
                <option value="straight_line">Straight Line</option>
                <option value="declining_balance">Declining Balance</option>
              </GlassSelect>
            </GlassField>
            <GlassField label="Serial Number">
              <GlassInput value={form.serial_number || ''} onChange={e => setForm(f => ({ ...f, serial_number: e.target.value }))} />
            </GlassField>
            <GlassField label="Location">
              <GlassInput value={form.location || ''} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </GlassField>
            <GlassField label="Vendor">
              <GlassInput value={form.vendor_name || ''} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} />
            </GlassField>
          </div>
        </GlassModal>
      )}
    </div>
  );
}
