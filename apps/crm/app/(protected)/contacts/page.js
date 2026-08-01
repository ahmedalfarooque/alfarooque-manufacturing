'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassPagination, GlassModal, GlassField, toast, GlassTh, GlassTd } from '@/components/glass';

const TYPES = ['Lead', 'Prospect', 'Customer', 'Partner', 'Supplier'];
function typeTone(t) { return t === 'Customer' ? 'success' : t === 'Lead' ? 'info' : t === 'Prospect' ? 'warning' : 'neutral'; }

export default function ContactsPage() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ contact_type: 'Lead' });
  const [saving, setSaving] = useState(false);
  const pageSize = 25;

  const params = new URLSearchParams({ page, pageSize });
  if (search) params.set('search', search);
  if (type) params.set('type', type);
  const { data, refresh } = useLiveData(`/api/contacts?${params}`, 15000);
  const contacts = data?.contacts || [];

  async function create() {
    setSaving(true);
    try {
      const res = await fetch('/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed');
      toast('Contact created', 'success');
      setShowForm(false);
      setForm({ contact_type: 'Lead' });
      refresh();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function del(id) {
    if (!confirm('Delete this contact?')) return;
    const res = await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Deleted', 'success'); refresh(); }
    else toast('Delete failed', 'error');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Contacts</h1>
        <GlassButton onClick={() => setShowForm(true)}>+ New Contact</GlassButton>
      </div>

      <GlassCard>
        <div className="flex gap-3 mb-4">
          <GlassInput placeholder="Search name, email, company…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1" />
          <GlassSelect value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </GlassSelect>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <GlassTh>Name</GlassTh>
              <GlassTh>Company</GlassTh>
              <GlassTh>Email</GlassTh>
              <GlassTh>Phone</GlassTh>
              <GlassTh>Type</GlassTh>
              <GlassTh></GlassTh>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                <GlassTd>
                  <Link href={`/contacts/${c.id}`} className="text-cyan-400 hover:text-cyan-300 font-medium">{c.name}</Link>
                </GlassTd>
                <GlassTd className="text-slate-400">{c.company || '—'}</GlassTd>
                <GlassTd className="text-slate-400">{c.email || '—'}</GlassTd>
                <GlassTd className="text-slate-400">{c.phone || '—'}</GlassTd>
                <GlassTd><GlassBadge tone={typeTone(c.contact_type)}>{c.contact_type}</GlassBadge></GlassTd>
                <GlassTd>
                  <div className="flex gap-1">
                    <Link href={`/contacts/${c.id}`}><GlassButton variant="secondary" size="sm">View</GlassButton></Link>
                    <GlassButton variant="danger" size="sm" onClick={() => del(c.id)}>Del</GlassButton>
                  </div>
                </GlassTd>
              </tr>
            ))}
            {!contacts.length && (
              <tr><td colSpan={6} className="text-center text-slate-500 py-8">No contacts found.</td></tr>
            )}
          </tbody>
        </table>

        <GlassPagination page={page} pageSize={pageSize} total={data?.total || 0} onPage={setPage} />
      </GlassCard>

      {showForm && (
        <GlassModal title="New Contact" onClose={() => setShowForm(false)} footer={
          <div className="flex gap-2 justify-end">
            <GlassButton variant="secondary" onClick={() => setShowForm(false)}>Cancel</GlassButton>
            <GlassButton onClick={create} disabled={saving}>{saving ? 'Saving…' : 'Create'}</GlassButton>
          </div>
        }>
          <div className="grid grid-cols-2 gap-4">
            <GlassField label="Full Name" required>
              <GlassInput value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </GlassField>
            <GlassField label="Type">
              <GlassSelect value={form.contact_type || 'Lead'} onChange={e => setForm(f => ({ ...f, contact_type: e.target.value }))}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </GlassSelect>
            </GlassField>
            <GlassField label="Company">
              <GlassInput value={form.company || ''} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </GlassField>
            <GlassField label="Job Title">
              <GlassInput value={form.job_title || ''} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} />
            </GlassField>
            <GlassField label="Email">
              <GlassInput type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </GlassField>
            <GlassField label="Phone">
              <GlassInput value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </GlassField>
            <GlassField label="Source">
              <GlassSelect value={form.source || ''} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                <option value="">Select source</option>
                <option>Website</option><option>Referral</option><option>Cold Call</option>
                <option>Exhibition</option><option>LinkedIn</option><option>Other</option>
              </GlassSelect>
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
