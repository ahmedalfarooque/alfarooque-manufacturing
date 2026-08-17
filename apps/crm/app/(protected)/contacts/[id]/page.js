'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassModal, GlassInput, GlassSelect, GlassField, GlassTextarea, toast } from '@/components/glass';
import { InitialAvatar, MetricCard, TimelineItem, CRMEmptyRow } from '@/components/CRMWidgets';

const CONTACT_TYPES = ['Lead', 'Prospect', 'Customer', 'Partner', 'Supplier'];

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }
/* GlassBadge's tone table only defines neutral/cyan/emerald/amber/red/violet/slate
   (see components/glass.js) — 'success'/'error'/'info' silently fell back to
   neutral, so every badge on this page rendered the same gray. Mapped to real tones. */
function dealTone(s) { return s === 'Won' ? 'emerald' : s === 'Lost' ? 'red' : 'cyan'; }
function typeTone(t) { return t === 'Customer' ? 'emerald' : t === 'Lead' ? 'cyan' : t === 'Prospect' ? 'amber' : t === 'Partner' ? 'violet' : 'slate'; }
function avatarTone(t) { return t === 'Customer' ? 'emerald' : t === 'Lead' ? 'cyan' : t === 'Prospect' ? 'amber' : 'violet'; }

/* Same taxonomy as Accounting's SmartERP UI (see apps/shared/integrationPlatform.js
   classifySmartErpError) — a 401 permission denial is not the same thing as
   SmartERP being unreachable, so this card must not say "Offline" for both. */
function smartErpStatusTone(status) {
  if (status === 'connected') return 'emerald';
  if (status === 'permission_required' || status === 'endpoint_or_version_mismatch') return 'amber';
  if (status === 'connection_error' || status === 'other_error') return 'red';
  return 'slate';
}
function smartErpStatusLabel(status) {
  if (status === 'connected') return 'Live';
  if (status === 'permission_required') return 'Permission required';
  if (status === 'endpoint_or_version_mismatch') return 'Endpoint unavailable';
  if (status === 'connection_error') return 'Connection error';
  if (status === 'other_error') return 'Error';
  return 'Pending';
}

export default function ContactDetailPage() {
  const { id } = useParams();
  const { data, loading, refresh } = useLiveData(`/api/contacts/${id}`, 0);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  if (loading) return <div className="text-center text-[color:var(--tx-3)] py-12">Loading…</div>;
  if (!data) return <div className="text-center text-[color:var(--tx-3)] py-12">Contact not found.</div>;

  const { contact, deals, activities, customer360 = {} } = data;
  const openDeals = deals.filter(d => d.status !== 'Won' && d.status !== 'Lost').length;
  const overdueFollowUps = activities.filter(a => a.status === 'Planned' && a.activity_date && new Date(a.activity_date) < new Date()).length;

  async function initializeIdentity() {
    const res = await fetch(`/api/contacts/${id}/identity`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (res.ok) { toast('Customer identity initialized', 'success'); refresh(); }
    else toast('Could not initialize customer identity', 'error');
  }

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
      <div className="flex items-center gap-3">
        <Link href="/contacts"><GlassButton variant="secondary" size="sm">← Back</GlassButton></Link>
      </div>

      <GlassCard className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <InitialAvatar name={contact.name} size={52} tone={avatarTone(contact.contact_type)} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[color:var(--tx)] truncate">{contact.name}</h1>
              <GlassBadge tone={typeTone(contact.contact_type)}>{contact.contact_type}</GlassBadge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1 text-sm text-[color:var(--tx-3)]">
              {contact.company && <span>{contact.company}{contact.job_title ? ` · ${contact.job_title}` : ''}</span>}
              {contact.email && <span dir="ltr">{contact.email}</span>}
              {contact.phone && <span dir="ltr">{contact.phone}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <GlassButton variant="secondary" onClick={openEdit}>Edit</GlassButton>
          {contact.contact_type === 'Lead' && <GlassButton onClick={() => convertType('Prospect')}>Convert to Prospect</GlassButton>}
          {contact.contact_type === 'Prospect' && <GlassButton onClick={() => convertType('Customer')}>Convert to Customer</GlassButton>}
        </div>
      </GlassCard>

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
          <h3 className="text-sm font-semibold text-[color:var(--tx-2)] mb-3">Contact Info</h3>
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
                <dt className="text-[color:var(--tx-4)] w-20 shrink-0">{k}</dt>
                <dd className="text-[color:var(--tx)]">{v}</dd>
              </div>
            ) : null)}
          </dl>
          {contact.notes && <p className="mt-3 text-[color:var(--tx-3)] text-sm border-t border-[color:var(--bd)] pt-3">{contact.notes}</p>}
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[color:var(--tx-2)]">Deals ({deals.length})</h3>
            <Link href={`/deals?contact=${id}`}><GlassButton variant="secondary" size="sm">+ Deal</GlassButton></Link>
          </div>
          {!deals.length ? <p className="text-[color:var(--tx-4)] text-sm">No deals yet.</p> : (
            <div className="space-y-2">
              {deals.map(d => (
                <Link key={d.id} href={`/deals/${d.id}`} className="block p-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[color:var(--tx)]">{d.title}</span>
                    <GlassBadge tone={dealTone(d.status)}>{d.status}</GlassBadge>
                  </div>
                  <p className="text-[color:var(--pr)] text-xs mt-1">SAR {fmt(d.value)}</p>
                </Link>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <h3 className="text-sm font-semibold text-[color:var(--tx-2)] mb-3">Recent Activities ({activities.length})</h3>
          {!activities.length ? <p className="text-[color:var(--tx-4)] text-sm">No activities yet.</p> : (
            <div className="space-y-2">
              {activities.map(a => (
                <div key={a.id} className="p-2 rounded-lg bg-black/5 dark:bg-white/5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[color:var(--tx)] font-medium">{a.subject}</span>
                    <GlassBadge tone="neutral">{a.activity_type}</GlassBadge>
                  </div>
                  <p className="text-[color:var(--tx-3)] text-xs mt-1">{a.activity_date}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div><h2 className="text-xl font-bold text-[color:var(--tx)]">Customer 360</h2><p className="text-xs text-[color:var(--tx-3)]">Relationship data remains linked to each source system</p></div>
        {!customer360.identity && <GlassButton onClick={initializeIdentity}>Initialize master identity</GlassButton>}
      </div>

      {/* Summary strip — real counts/totals only, no fabricated figures. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <MetricCard label="Quotations" value={(customer360.quotations || []).length} icon="receipt" tone="cyan" />
        <MetricCard label="Sales Orders" value={(customer360.salesOrders || []).length} icon="box" tone="violet" />
        <MetricCard label="Projects" value={(customer360.projects || []).length} icon="folder" tone="amber" />
        <MetricCard label="Open Opportunities" value={openDeals} icon="target" tone="cyan" />
        <MetricCard label="Invoices" value={(customer360.smartErp?.invoices || []).length} icon="receipt" tone="slate" />
        <MetricCard label="Outstanding" value={`SAR ${fmt(customer360.smartErp?.summary?.outstanding)}`} icon="receipt" tone="red" />
        <MetricCard label="Follow-ups Overdue" value={overdueFollowUps} icon="clock" tone={overdueFollowUps ? 'amber' : 'emerald'} />
      </div>

      <div className="grid lg:grid-cols-2 xl:grid-cols-5 gap-4">
        <GlassCard className="p-4"><h3 className="font-semibold text-[color:var(--tx)]">System identity</h3><p className="mt-2 text-sm text-[color:var(--tx-3)]">{customer360.identity?.mapping_status || 'Not initialized'}</p><div className="mt-3 flex flex-wrap gap-2">{(customer360.mappings || []).map(m => <GlassBadge key={m.id} tone={m.sync_status === 'synced' || m.sync_status === 'mapped' ? 'emerald' : 'amber'}>{m.source_system}: {m.sync_status}</GlassBadge>)}</div></GlassCard>
        <GlassCard className="p-4"><h3 className="font-semibold text-[color:var(--tx)]">Quotations</h3><p className="mt-1 text-2xl font-bold text-[color:var(--pr)]">{(customer360.quotations || []).length}</p><div className="mt-3 space-y-2">{(customer360.quotations || []).slice(0,3).map(q => <div key={q.id} className="text-xs"><span className="text-[color:var(--tx-2)]">{q.quote_number}</span><span className="float-end text-[color:var(--tx-3)]">{q.status}</span></div>)}</div></GlassCard>
        <GlassCard className="p-4"><h3 className="font-semibold text-[color:var(--tx)]">Sales Orders</h3><p className="mt-1 text-2xl font-bold text-[color:var(--pr)]">{(customer360.salesOrders || []).length}</p><div className="mt-3 space-y-2">{!(customer360.salesOrders || []).length ? <p className="text-[color:var(--tx-4)] text-xs">No sales orders yet.</p> : (customer360.salesOrders || []).slice(0,3).map(so => <div key={so.id} className="text-xs"><span className="text-[color:var(--tx-2)]" dir="ltr">{so.so_number}</span><span className="float-end text-[color:var(--tx-3)]">{so.status}</span></div>)}</div></GlassCard>
        <GlassCard className="p-4"><h3 className="font-semibold text-[color:var(--tx)]">Projects</h3><p className="mt-1 text-2xl font-bold text-[color:var(--pr)]">{(customer360.projects || []).length}</p><div className="mt-3 space-y-2">{(customer360.projects || []).slice(0,3).map(p => <div key={p.id} className="text-xs"><span className="text-[color:var(--tx-2)]">{p.project_name}</span><span className="float-end text-[color:var(--tx-3)]">{p.status}</span></div>)}</div></GlassCard>
        <GlassCard className="p-4"><div className="flex items-center justify-between"><h3 className="font-semibold text-[color:var(--tx)]">Finance — SmartERP</h3><GlassBadge tone={smartErpStatusTone(customer360.smartErp?.status)}>{smartErpStatusLabel(customer360.smartErp?.status)}</GlassBadge></div><p className="mt-2 text-2xl font-bold text-[color:var(--pr)]">{(customer360.smartErp?.invoices || []).length}</p><p className="text-xs text-[color:var(--tx-3)]">Sales invoices · {customer360.smartErp?.source === 'synchronized_snapshot' ? 'synced snapshot' : customer360.smartErp?.source === 'live' ? 'live source' : 'no matching source records'}</p><dl className="mt-3 space-y-1 text-xs"><div className="flex justify-between"><dt>Invoiced</dt><dd>SAR {fmt(customer360.smartErp?.summary?.invoiced)}</dd></div><div className="flex justify-between"><dt>Paid</dt><dd>SAR {fmt(customer360.smartErp?.summary?.paid)}</dd></div><div className="flex justify-between font-semibold"><dt>Outstanding</dt><dd>SAR {fmt(customer360.smartErp?.summary?.outstanding)}</dd></div></dl>{customer360.smartErp?.lastSyncedAt&&<p className="mt-2 text-[10px] text-[color:var(--tx-4)]">Last synced {new Date(customer360.smartErp.lastSyncedAt).toLocaleString()}</p>}</GlassCard>
      </div>

      <GlassCard>
        <h3 className="text-sm font-semibold text-[color:var(--tx-2)] mb-4">Timeline</h3>
        {!(customer360.timeline || []).length ? (
          <CRMEmptyRow text="No timeline events recorded yet." />
        ) : (
          <div>
            {(customer360.timeline || []).slice(0, 12).map((event, i, arr) => (
              <TimelineItem key={event.id}
                title={event.title || event.event_type || 'Event'}
                meta={event.source_system}
                time={event.occurred_at ? new Date(event.occurred_at).toLocaleString() : ''}
                isLast={i === arr.length - 1}
              />
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
