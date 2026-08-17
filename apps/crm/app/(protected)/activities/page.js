'use client';

import { useState } from 'react';
import { useLiveData } from '@/lib/useLiveData';
import { useLang } from '@/lib/i18n';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassPagination, GlassModal, GlassField, toast, GlassTh, GlassTd, GlassSkeletonRows } from '@/components/glass';
import { CRMEmptyState } from '@/components/CRMWidgets';
import DateFilter, { resolveDateRange, dateFilterLabel } from '@/components/DateFilter';

const TYPES = ['Call', 'Meeting', 'Email', 'Demo', 'Follow-up', 'Task', 'Note'];
const STATUSES = ['Planned', 'Completed', 'Cancelled', 'No Show'];
/* GlassBadge's tone table only defines neutral/cyan/emerald/amber/red/violet/slate
   (see components/glass.js) — 'success'/'error'/'warning'/'info' silently fell back
   to neutral, so every status badge on this page rendered the same gray. */
function statusTone(s) { return s === 'Completed' ? 'emerald' : s === 'Cancelled' ? 'red' : s === 'No Show' ? 'amber' : 'cyan'; }

export default function ActivitiesPage() {
  const { t, lang } = useLang();
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: null, to: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ activity_type: 'Call' });
  const [saving, setSaving] = useState(false);
  const [reportBusy, setReportBusy] = useState('');
  const { from: dateFrom, to: dateTo } = resolveDateRange(dateFilter);

  const params = new URLSearchParams({ page, pageSize });
  if (type) params.set('type', type);
  if (status) params.set('status', status);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const { data, refresh } = useLiveData(`/api/activities?${params}`, 15000);
  const activities = data?.activities || [];

  async function fetchAllActivities() {
    const q = new URLSearchParams({ page: 1, pageSize: 500 });
    if (type) q.set('type', type);
    if (status) q.set('status', status);
    if (dateFrom) q.set('dateFrom', dateFrom);
    if (dateTo) q.set('dateTo', dateTo);
    const first = await fetch(`/api/activities?${q}`).then(r => r.json());
    let rows = first.activities || [];
    const total = first.total || rows.length;
    const totalPages = Math.ceil(total / 500);
    for (let p = 2; p <= totalPages; p++) {
      q.set('page', p);
      const next = await fetch(`/api/activities?${q}`).then(r => r.json());
      rows = rows.concat(next.activities || []);
    }
    return rows;
  }

  async function runReport(action) {
    setReportBusy(action);
    try {
      const all = await fetchAllActivities();
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({
        title: `Activities${dateFilter.preset !== 'all' ? ` — Period: ${dateFilterLabel(dateFilter, t, lang)}` : ''}`,
        columns: [
          { key: 'type', header: 'Type' }, { key: 'subject', header: 'Subject' },
          { key: 'contact', header: 'Contact' }, { key: 'deal', header: 'Deal' },
          { key: 'date', header: 'Date' }, { key: 'status', header: 'Status' },
        ],
        rows: all.map(a => ({
          type: a.activity_type || '—', subject: a.subject || '—',
          contact: a.crm_contacts?.name || '—', deal: a.crm_deals?.title || '—',
          date: a.activity_date || '—', status: a.status || '—',
        })),
        lang, fileName: 'activities-report.pdf', action,
      });
    } catch (e) { toast('Report generation failed', 'error'); }
    finally { setReportBusy(''); }
  }

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
        <h1 className="text-2xl font-bold text-[color:var(--tx)]">Activities</h1>
        <div className="flex items-center gap-2">
          <GlassButton variant="secondary" onClick={() => runReport('print')} disabled={!data?.total || !!reportBusy}>{reportBusy === 'print' ? '…' : t('print')}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runReport('save')} disabled={!data?.total || !!reportBusy}>⇩ {reportBusy === 'save' ? '…' : t('downloadPdf')}</GlassButton>
          <GlassButton onClick={() => setShowForm(true)}>+ Log Activity</GlassButton>
        </div>
      </div>

      <GlassCard>
        <div className="flex flex-wrap gap-3 mb-4">
          <GlassSelect value={type} onChange={e => { setType(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            {TYPES.map(t => <option key={t}>{t}</option>)}
          </GlassSelect>
          <GlassSelect value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </GlassSelect>
          <DateFilter value={dateFilter} onChange={v => { setDateFilter(v); setPage(1); }} t={t} lang={lang} />
        </div>

        {!data ? (
          <GlassSkeletonRows rows={6} cols={6} />
        ) : !activities.length && !type && !status ? (
          <CRMEmptyState
            title="No activities logged yet"
            text="Log calls, meetings, and follow-ups to keep a full history of every relationship."
            actionLabel="+ Log Activity"
            onAction={() => setShowForm(true)}
          />
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--bd)]">
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
              <tr key={a.id} className="border-b border-[color:var(--bd)] hover:bg-[color:var(--pr-soft)]">
                <GlassTd><GlassBadge tone="neutral">{a.activity_type}</GlassBadge></GlassTd>
                <GlassTd className="text-[color:var(--tx)]">{a.subject}</GlassTd>
                <GlassTd className="text-[color:var(--tx-3)]">{a.crm_contacts?.name || '—'}</GlassTd>
                <GlassTd className="text-[color:var(--tx-3)]">{a.crm_deals?.title || '—'}</GlassTd>
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
              <tr><td colSpan={7} className="text-center text-[color:var(--tx-4)] py-8">No activities found.</td></tr>
            )}
          </tbody>
        </table>
        )}

        <GlassPagination page={page} pageSize={pageSize} total={data?.total || 0} onPage={setPage}
          onPageSize={v => { setPageSize(v); setPage(1); }} />
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
