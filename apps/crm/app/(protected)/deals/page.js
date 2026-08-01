'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassPagination, GlassModal, GlassField, toast, GlassTh, GlassTd } from '@/components/glass';

const STATUSES = ['Open', 'Won', 'Lost', 'On Hold'];
const STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];
function statusTone(s) { return s === 'Won' ? 'success' : s === 'Lost' ? 'error' : s === 'On Hold' ? 'warning' : 'info'; }
function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

export default function DealsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ stage: 'Prospecting', currency: 'SAR' });
  const [saving, setSaving] = useState(false);
  const pageSize = 25;

  const params = new URLSearchParams({ page, pageSize });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  const { data, refresh } = useLiveData(`/api/deals?${params}`, 15000);
  const deals = data?.deals || [];

  async function create() {
    setSaving(true);
    try {
      const res = await fetch('/api/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed');
      toast('Deal created', 'success');
      setShowForm(false);
      setForm({ stage: 'Prospecting', currency: 'SAR' });
      refresh();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function markWon(id) {
    const res = await fetch(`/api/deals/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Won', stage: 'Closed Won' }) });
    if (res.ok) { toast('Deal marked Won!', 'success'); refresh(); }
    else toast('Update failed', 'error');
  }

  async function del(id) {
    if (!confirm('Delete this deal?')) return;
    const res = await fetch(`/api/deals/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Deleted', 'success'); refresh(); }
    else toast('Delete failed', 'error');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Deals</h1>
        <GlassButton onClick={() => setShowForm(true)}>+ New Deal</GlassButton>
      </div>

      <GlassCard>
        <div className="flex gap-3 mb-4">
          <GlassInput placeholder="Search deal title…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1" />
          <GlassSelect value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </GlassSelect>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <GlassTh>Title</GlassTh>
              <GlassTh>Contact</GlassTh>
              <GlassTh>Stage</GlassTh>
              <GlassTh>Value</GlassTh>
              <GlassTh>Status</GlassTh>
              <GlassTh>Close Date</GlassTh>
              <GlassTh></GlassTh>
            </tr>
          </thead>
          <tbody>
            {deals.map(d => (
              <tr key={d.id} className="border-b border-white/5 hover:bg-white/5">
                <GlassTd>
                  <Link href={`/deals/${d.id}`} className="text-cyan-400 hover:text-cyan-300 font-medium">{d.title}</Link>
                </GlassTd>
                <GlassTd className="text-slate-400">{d.crm_contacts?.name || '—'}</GlassTd>
                <GlassTd><GlassBadge tone="neutral">{d.stage}</GlassBadge></GlassTd>
                <GlassTd className="font-medium text-white">SAR {fmt(d.value)}</GlassTd>
                <GlassTd><GlassBadge tone={statusTone(d.status)}>{d.status}</GlassBadge></GlassTd>
                <GlassTd className="text-slate-400">{d.expected_close_date || '—'}</GlassTd>
                <GlassTd>
                  <div className="flex gap-1">
                    {d.status === 'Open' && <GlassButton variant="secondary" size="sm" onClick={() => markWon(d.id)}>Won</GlassButton>}
                    <GlassButton variant="danger" size="sm" onClick={() => del(d.id)}>Del</GlassButton>
                  </div>
                </GlassTd>
              </tr>
            ))}
            {!deals.length && (
              <tr><td colSpan={7} className="text-center text-slate-500 py-8">No deals found.</td></tr>
            )}
          </tbody>
        </table>

        <GlassPagination page={page} pageSize={pageSize} total={data?.total || 0} onPage={setPage} />
      </GlassCard>

      {showForm && (
        <GlassModal title="New Deal" onClose={() => setShowForm(false)} footer={
          <div className="flex gap-2 justify-end">
            <GlassButton variant="secondary" onClick={() => setShowForm(false)}>Cancel</GlassButton>
            <GlassButton onClick={create} disabled={saving}>{saving ? 'Creating…' : 'Create'}</GlassButton>
          </div>
        }>
          <div className="grid grid-cols-2 gap-4">
            <GlassField label="Deal Title" required>
              <GlassInput value={form.title || ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </GlassField>
            <GlassField label="Stage">
              <GlassSelect value={form.stage || 'Prospecting'} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                {STAGES.map(s => <option key={s}>{s}</option>)}
              </GlassSelect>
            </GlassField>
            <GlassField label="Value">
              <GlassInput type="number" step="0.01" value={form.value || ''} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
            </GlassField>
            <GlassField label="Currency">
              <GlassSelect value={form.currency || 'SAR'} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option>SAR</option><option>USD</option><option>EUR</option><option>AED</option>
              </GlassSelect>
            </GlassField>
            <GlassField label="Expected Close Date">
              <GlassInput type="date" value={form.expected_close_date || ''} onChange={e => setForm(f => ({ ...f, expected_close_date: e.target.value }))} />
            </GlassField>
            <GlassField label="Win Probability (%)">
              <GlassInput type="number" min="0" max="100" value={form.probability || ''} onChange={e => setForm(f => ({ ...f, probability: e.target.value }))} />
            </GlassField>
            <GlassField label="Description" className="col-span-2">
              <GlassInput value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </GlassField>
          </div>
        </GlassModal>
      )}
    </div>
  );
}
