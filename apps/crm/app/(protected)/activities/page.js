'use client';

import { useState } from 'react';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassPagination, GlassModal, GlassField, toast, GlassTh, GlassTd } from '@/components/glass';

const TYPES = ['Call', 'Meeting', 'Email', 'Demo', 'Follow-up', 'Task', 'Note'];
const STATUSES = ['Planned', 'Completed', 'Cancelled', 'No Show'];
function statusTone(s) { return s === 'Completed' ? 'success' : s === 'Cancelled' ? 'error' : s === 'No Show' ? 'warning' : 'info'; }

export default function ActivitiesPage() {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ activity_type: 'Call' });
  const [saving, setSaving] = useState(false);
  const pageSize = 25;

  const params = new URLSearchParams({ page, pageSize });
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  const { data, refresh } = useLiveData(`/api/activities?${params}`, 15000);
  const activities = data?.activities || [];

  async function create() {
    setSaving(true);
    try {
      const res = await fetch('/api/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed');
      toast('Activity logged', 'success');
      setShowForm(false);
      setForm({ activity_type: 'Call' });
      refresh();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function complete(id) {
    const res = await fetch(`/api/activities/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'Completed' }) });
    if (res.ok) { toast('Marked complete', 'success'); refresh(); }
    else toast('Update failed', 'error');
  }

  async function del(id) {
    if (!confirm('Delete this activity?')) return;
    const res = await fetch(`/api/activities/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Deleted', 'success'); refresh(); }
    else toast('Delete failed', 'error');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Activities</h1>
        <GlassButton onClick={() => setShowForm(true)}>+ Log Activity</GlassButton>
      </div>

      <GlassCard>
        <div className="flex gap-3 mb-4">
          <GlassSelect value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </GlassSelect>
          <GlassSelect value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </GlassSelect>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <GlassTh>Type</GlassTh>
              <GlassTh>Subject</GlassTh>
              <GlassTh>Contact</GlassTh>
              <GlassTh>Deal</GlassTh>
              <GlassTh>Date</GlassTh>
              <GlassTh>Status</GlassTh>
              <GlassTh></GlassTh>
            </tr>
          </thead>
          <tbody>
            {activities.map(a => (
              <tr key={a.id} className="border-b border-white/5 hover:bg-white/5">
                <GlassTd><GlassBadge tone="neutral">{a.activity_type}</GlassBadge></GlassTd>
                <GlassTd className="text-white">{a.subject}</GlassTd>
                <GlassTd className="text-slate-400">{a.crm_contacts?.name || '—'}</GlassTd>
                <GlassTd className="text-slate-400">{a.crm_deals?.title || '—'}</GlassTd>
                <GlassTd>{a.activity_date}</GlassTd>
                <GlassTd><GlassBadge tone={statusTone(a.status)}>{a.status}</GlassBadge></GlassTd>
                <GlassTd>
                  <div className="flex gap-1">
                    {a.status === 'Planned' && <GlassButton variant="secondary" size="sm" onClick={() => complete(a.id)}>Done</GlassButton>}
                    <GlassButton variant="danger" size="sm" onClick={() => del(a.id)}>Del</GlassButton>
                  </div>
                </GlassTd>
              </tr>
            ))}
            {!activities.length && (
              <tr><td colSpan={7} className="text-center text-slate-500 py-8">No activities found.</td></tr>
            )}
          </tbody>
        </table>

        <GlassPagination page={page} pageSize={pageSize} total={data?.total || 0} onPage={setPage} />
      </GlassCard>

      {showForm && (
        <GlassModal title="Log Activity" onClose={() => setShowForm(false)} footer={
          <div className="flex gap-2 justify-end">
            <GlassButton variant="secondary" onClick={() => setShowForm(false)}>Cancel</GlassButton>
            <GlassButton onClick={create} disabled={saving}>{saving ? 'Saving…' : 'Save'}</GlassButton>
          </div>
        }>
          <div className="grid grid-cols-2 gap-4">
            <GlassField label="Type">
              <GlassSelect value={form.activity_type || 'Call'} onChange={e => setForm(f => ({ ...f, activity_type: e.target.value }))}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </GlassSelect>
            </GlassField>
            <GlassField label="Subject" required>
              <GlassInput value={form.subject || ''} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
            </GlassField>
            <GlassField label="Date">
              <GlassInput type="date" value={form.activity_date || ''} onChange={e => setForm(f => ({ ...f, activity_date: e.target.value }))} />
            </GlassField>
            <GlassField label="Duration (min)">
              <GlassInput type="number" value={form.duration_minutes || ''} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} />
            </GlassField>
            <GlassField label="Outcome">
              <GlassInput value={form.outcome || ''} onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))} />
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
