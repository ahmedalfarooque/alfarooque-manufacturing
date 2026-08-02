'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassModal, GlassInput, GlassSelect, GlassField, GlassTextarea, toast } from '@/components/glass';

const CONTACT_TYPES = ['Lead', 'Prospect', 'Customer', 'Partner', 'Supplier'];

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }
function dealTone(s) { return s === 'Won' ? 'success' : s === 'Lost' ? 'error' : 'info'; }

export default function ContactDetailPage() {
  const { id } = useParams();
  const { data, loading, refresh } = useLiveData(`/api/contacts/${id}`, 0);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  if (loading) return <div className="text-center text-slate-400 py-12">Loading…</div>;
  if (!data) return <div className="text-center text-slate-400 py-12">Contact not found.</div>;

  const { contact, deals, activities } = data;

  async function convertType(type) {
    const res = await fetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_type: type }) });
    if (res.ok) { toast('Updated', 'success'); refresh(); }
    else toast('Update failed', 'error');
  }

  function openEdit() {
    setForm({
      name: contact.name || '', email: contact.email || '', phone: contact.phone || '',
      company: contact.company || '', job_title: contact.job_title || '', contact_type: contact.contact_type || 'Lead',
      source: contact.source || '', address: contact.address || '', notes: contact.notes || '',
    });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Update failed');
      toast('Contact updated', 'success');
      setEditing(false);
      refresh();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/contacts"><GlassButton variant="secondary" size="sm">← Back</GlassButton></Link>
          <h1 className="text-2xl font-bold text-white">{contact.name}</h1>
          <GlassBadge tone="info">{contact.contact_type}</GlassBadge>
        </div>
        <div className="flex gap-2">
          <GlassButton variant="secondary" onClick={openEdit}>Edit</GlassButton>
          {contact.contact_type === 'Lead' && <GlassButton onClick={() => convertType('Prospect')}>Convert to Prospect</GlassButton>}
          {contact.contact_type === 'Prospect' && <GlassButton onClick={() => convertType('Customer')}>Convert to Customer</GlassButton>}
        </div>
      </div>

      {editing && form && (
        <GlassModal title="Edit Contact" onClose={() => setEditing(false)} footer={
          <div className="flex gap-2 justify-end">
            <GlassButton variant="secondary" onClick={() => setEditing(false)}>Cancel</GlassButton>
            <GlassButton onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</GlassButton>
          </div>
        }>
          <div className="grid grid-cols-2 gap-4">
            <GlassField label="Name" required>
              <GlassInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </GlassField>
            <GlassField label="Contact Type">
              <GlassSelect value={form.contact_type} onChange={e => setForm(f => ({ ...f, contact_type: e.target.value }))}>
                {CONTACT_TYPES.map(t => <option key={t}>{t}</option>)}
              </GlassSelect>
            </GlassField>
            <GlassField label="Email">
              <GlassInput type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </GlassField>
            <GlassField label="Phone">
              <GlassInput value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </GlassField>
            <GlassField label="Company">
              <GlassInput value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </GlassField>
            <GlassField label="Job Title">
              <GlassInput value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} />
            </GlassField>
            <GlassField label="Source">
              <GlassInput value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} />
            </GlassField>
            <GlassField label="Address">
              <GlassInput value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </GlassField>
            <div className="col-span-2">
              <GlassField label="Notes">
                <GlassTextarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </GlassField>
            </div>
          </div>
        </GlassModal>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <GlassCard>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Contact Info</h3>
          <dl className="space-y-2 text-sm">
            {[
              ['Company', contact.company],
              ['Job Title', contact.job_title],
              ['Email', contact.email],
              ['Phone', contact.phone],
              ['Source', contact.source],
              ['Address', contact.address],
            ].map(([k, v]) => v ? (
              <div key={k} className="flex gap-2">
                <dt className="text-slate-500 w-20 shrink-0">{k}</dt>
                <dd className="text-white">{v}</dd>
              </div>
            ) : null)}
          </dl>
          {contact.notes && <p className="mt-3 text-slate-400 text-sm border-t border-white/10 pt-3">{contact.notes}</p>}
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-300">Deals ({deals.length})</h3>
            <Link href={`/deals?contact=${id}`}><GlassButton variant="secondary" size="sm">+ Deal</GlassButton></Link>
          </div>
          {!deals.length ? <p className="text-slate-500 text-sm">No deals yet.</p> : (
            <div className="space-y-2">
              {deals.map(d => (
                <Link key={d.id} href={`/deals/${d.id}`} className="block p-2 rounded-lg bg-white/5 hover:bg-white/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white">{d.title}</span>
                    <GlassBadge tone={dealTone(d.status)}>{d.status}</GlassBadge>
                  </div>
                  <p className="text-cyan-400 text-xs mt-1">SAR {fmt(d.value)}</p>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Recent Activities ({activities.length})</h3>
          {!activities.length ? <p className="text-slate-500 text-sm">No activities yet.</p> : (
            <div className="space-y-2">
              {activities.map(a => (
                <div key={a.id} className="p-2 rounded-lg bg-white/5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-medium">{a.subject}</span>
                    <GlassBadge tone="neutral">{a.activity_type}</GlassBadge>
                  </div>
                  <p className="text-slate-400 text-xs mt-1">{a.activity_date}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
