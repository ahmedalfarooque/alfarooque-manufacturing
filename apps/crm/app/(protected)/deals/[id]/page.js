'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassModal, GlassInput, GlassSelect, GlassField, GlassTextarea, toast } from '@/components/glass';
import { InitialAvatar } from '@/components/CRMWidgets';

const STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }
/* GlassBadge's tone table only defines neutral/cyan/emerald/amber/red/violet/slate
   (see components/glass.js) — 'success'/'error'/'warning'/'info' silently fell back
   to neutral, so every status badge on this page rendered the same gray. */
function statusTone(s) { return s === 'Won' ? 'emerald' : s === 'Lost' ? 'red' : s === 'On Hold' ? 'amber' : 'cyan'; }

export default function DealDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data, loading, refresh } = useLiveData(`/api/deals/${id}`, 0);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  if (loading) return <div className="text-center text-[color:var(--tx-3)] py-12">Loading…</div>;
  if (!data) return <div className="text-center text-[color:var(--tx-3)] py-12">Deal not found.</div>;

  const { deal, activities, linkedQuotation, linkedProject } = data;

  async function setStatus(status, stage) {
    const patch = { status };
    if (stage) patch.stage = stage;
    const res = await fetch(`/api/deals/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    if (res.ok) { toast('Updated', 'success'); refresh(); }
    else toast('Update failed', 'error');
  }

  function openEdit() {
    setForm({
      title: deal.title || '', value: deal.value || 0, probability: deal.probability || 0,
      stage: deal.stage || 'Prospecting', expected_close_date: deal.expected_close_date || '',
      currency: deal.currency || 'SAR', description: deal.description || '',
      linked_quotation_id: deal.linked_quotation_id || '', linked_project_id: deal.linked_project_id || '',
    });
    setEditing(true);
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/deals/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Update failed');
      toast('Deal updated', 'success');
      setEditing(false);
      refresh();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function del() {
    if (!confirm('Delete this deal?')) return;
    const res = await fetch(`/api/deals/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Deleted', 'success'); router.push('/deals'); }
    else toast('Delete failed', 'error');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/deals"><GlassButton variant="secondary" size="sm">← Back</GlassButton></Link>
      </div>

      <GlassCard className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <InitialAvatar name={deal.title} size={52} tone={deal.status === 'Won' ? 'emerald' : deal.status === 'Lost' ? 'red' : 'cyan'} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[color:var(--tx)] truncate">{deal.title}</h1>
              <GlassBadge tone={statusTone(deal.status)}>{deal.status}</GlassBadge>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 mt-1 text-sm text-[color:var(--tx-3)]">
              <span>{deal.stage}</span>
              <span className="font-medium text-[color:var(--pr)]" dir="ltr">SAR {fmt(deal.value)}</span>
              {deal.expected_close_date && <span>Close: {deal.expected_close_date}</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <GlassButton variant="secondary" onClick={openEdit}>Edit</GlassButton>
          {deal.status === 'Open' && (
            <>
              <GlassButton onClick={() => setStatus('Won', 'Closed Won')}>Mark Won</GlassButton>
              <GlassButton variant="secondary" onClick={() => setStatus('Lost', 'Closed Lost')}>Mark Lost</GlassButton>
            </>
          )}
          <GlassButton variant="danger" onClick={del}>Delete</GlassButton>
        </div>
      </GlassCard>

      {editing && form && (
        <GlassModal title="Edit Deal" onClose={() => setEditing(false)} footer={
          <div className="flex gap-2 justify-end">
            <GlassButton variant="secondary" onClick={() => setEditing(false)}>Cancel</GlassButton>
            <GlassButton onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</GlassButton>
          </div>
        }>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <GlassField label="Title" required>
                <GlassInput value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </GlassField>
            </div>
            <GlassField label="Value">
              <GlassInput type="number" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
            </GlassField>
            <GlassField label="Currency">
              <GlassSelect value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                <option>SAR</option><option>USD</option><option>EUR</option><option>AED</option>
              </GlassSelect>
            </GlassField>
            <GlassField label="Stage">
              <GlassSelect value={form.stage} onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}>
                {STAGES.map(s => <option key={s}>{s}</option>)}
              </GlassSelect>
            </GlassField>
            <GlassField label="Probability (%)">
              <GlassInput type="number" min="0" max="100" value={form.probability} onChange={e => setForm(f => ({ ...f, probability: e.target.value }))} />
            </GlassField>
            <GlassField label="Expected Close Date">
              <GlassInput type="date" value={form.expected_close_date} onChange={e => setForm(f => ({ ...f, expected_close_date: e.target.value }))} />
            </GlassField>
            <div className="col-span-2">
              <GlassField label="Description">
                <GlassTextarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </GlassField>
            </div>
            <GlassField label="Linked Quotation ID">
              <GlassInput value={form.linked_quotation_id} onChange={e => setForm(f => ({ ...f, linked_quotation_id: e.target.value }))} placeholder="Quotation UUID (optional)" />
            </GlassField>
            <GlassField label="Linked Project ID">
              <GlassInput value={form.linked_project_id} onChange={e => setForm(f => ({ ...f, linked_project_id: e.target.value }))} placeholder="Project UUID (optional)" />
            </GlassField>
          </div>
        </GlassModal>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-[color:var(--tx-2)] mb-3">Deal Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-[color:var(--tx-3)]">Value</p><p className="text-2xl font-bold text-[color:var(--pr)]">SAR {fmt(deal.value)}</p></div>
            <div><p className="text-[color:var(--tx-3)]">Stage</p><p className="text-[color:var(--tx)] font-medium">{deal.stage}</p></div>
            <div><p className="text-[color:var(--tx-3)]">Probability</p><p className="text-[color:var(--tx)]">{deal.probability || 0}%</p></div>
            <div><p className="text-[color:var(--tx-3)]">Expected Close</p><p className="text-[color:var(--tx)]">{deal.expected_close_date || '—'}</p></div>
            <div><p className="text-[color:var(--tx-3)]">Currency</p><p className="text-[color:var(--tx)]">{deal.currency}</p></div>
          </div>
          {deal.description && <p className="mt-3 text-[color:var(--tx-2)] text-sm">{deal.description}</p>}
          {(linkedQuotation || linkedProject) && (
            <div className="mt-4 pt-4 border-t border-[color:var(--bd)] flex flex-wrap gap-4 text-sm">
              {linkedQuotation && (
                <div>
                  <p className="text-[color:var(--tx-3)]">Linked Quotation</p>
                  <p className="text-[color:var(--pr)] font-medium">{linkedQuotation.quote_number} <GlassBadge tone="neutral">{linkedQuotation.status}</GlassBadge></p>
                </div>
              )}
              {linkedProject && (
                <div>
                  <p className="text-[color:var(--tx-3)]">Linked Project</p>
                  <p className="text-[color:var(--pr)] font-medium">{linkedProject.project_name} <span className="text-[color:var(--tx-4)]">({linkedProject.customer_name || '—'})</span></p>
                </div>
              )}
            </div>
          )}
        </GlassCard>

        <GlassCard>
          <h3 className="text-sm font-semibold text-[color:var(--tx-2)] mb-3">Contact</h3>
          {deal.crm_contacts ? (
            <div className="text-sm">
              <Link href={`/contacts/${deal.contact_id}`} className="text-[color:var(--pr)] hover:text-[color:var(--pr-2)] font-medium">{deal.crm_contacts.name}</Link>
              {deal.crm_contacts.company && <p className="text-[color:var(--tx-3)] mt-1">{deal.crm_contacts.company}</p>}
              {deal.crm_contacts.email && <p className="text-[color:var(--tx-4)] mt-1">{deal.crm_contacts.email}</p>}
              {deal.crm_contacts.phone && <p className="text-[color:var(--tx-4)]">{deal.crm_contacts.phone}</p>}
            </div>
          ) : (
            <p className="text-[color:var(--tx-4)] text-sm">No contact linked.</p>
          )}
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="text-sm font-semibold text-[color:var(--tx-2)] mb-3">Activities ({activities.length})</h3>
        {!activities.length ? <p className="text-[color:var(--tx-4)] text-sm">No activities logged.</p> : (
          <div className="divide-y divide-[color:var(--bd)]">
            {activities.map(a => (
              <div key={a.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <span className="text-[color:var(--tx)]">{a.subject}</span>
                  {a.notes && <p className="text-[color:var(--tx-3)] text-xs mt-0.5">{a.notes}</p>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <GlassBadge tone="neutral">{a.activity_type}</GlassBadge>
                  <span className="text-[color:var(--tx-4)]">{a.activity_date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
