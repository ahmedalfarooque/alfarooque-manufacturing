'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { useLang } from '@/lib/i18n';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassPagination, GlassModal, GlassField, toast, GlassTh, GlassTd, GlassSkeletonRows } from '@/components/glass';
import { MetricCard, CRMEmptyState } from '@/components/CRMWidgets';
import DateFilter, { resolveDateRange, dateFilterLabel } from '@/components/DateFilter';

const STATUSES = ['Open', 'Won', 'Lost', 'On Hold'];
const STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];
/* GlassBadge's tone table only defines neutral/cyan/emerald/amber/red/violet/slate
   (see components/glass.js) — 'success'/'error'/'warning'/'info' silently fell back
   to neutral, so every status badge on this page rendered the same gray. */
function statusTone(s) { return s === 'Won' ? 'emerald' : s === 'Lost' ? 'red' : s === 'On Hold' ? 'amber' : 'cyan'; }
function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

export default function DealsPage() {
  const { t, lang } = useLang();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: null, to: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ stage: 'Prospecting', currency: 'SAR' });
  const [saving, setSaving] = useState(false);
  const [reportBusy, setReportBusy] = useState('');
  const { from: dateFrom, to: dateTo } = resolveDateRange(dateFilter);

  const params = new URLSearchParams({ page, pageSize });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const { data, refresh } = useLiveData(`/api/deals?${params}`, 15000);
  const deals = data?.deals || [];

  /* KPI strip: reuses the same /api/deals route already called by this page
     (no new API surface) to total up the filtered result set, since a single
     page of `deals` (25 rows) isn't enough to report an accurate pipeline total. */
  const [kpiRows, setKpiRows] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setKpiRows(null);
    fetchAllDeals().then(rows => { if (!cancelled) setKpiRows(rows); }).catch(() => { if (!cancelled) setKpiRows([]); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, dateFrom, dateTo, data?.total]);

  const kpiTotalValue = (kpiRows || []).reduce((sum, d) => sum + Number(d.value || 0), 0);
  const kpiOpen = (kpiRows || []).filter(d => d.status === 'Open').length;
  const kpiWon = (kpiRows || []).filter(d => d.status === 'Won').length;
  const kpiLost = (kpiRows || []).filter(d => d.status === 'Lost').length;

  async function fetchAllDeals() {
    const q = new URLSearchParams({ page: 1, pageSize: 500 });
    if (search) q.set('search', search);
    if (status) q.set('status', status);
    if (dateFrom) q.set('dateFrom', dateFrom);
    if (dateTo) q.set('dateTo', dateTo);
    const first = await fetch(`/api/deals?${q}`).then(r => r.json());
    let rows = first.deals || [];
    const total = first.total || rows.length;
    const totalPages = Math.ceil(total / 500);
    for (let p = 2; p <= totalPages; p++) {
      q.set('page', p);
      const next = await fetch(`/api/deals?${q}`).then(r => r.json());
      rows = rows.concat(next.deals || []);
    }
    return rows;
  }

  async function runReport(action) {
    setReportBusy(action);
    try {
      const all = await fetchAllDeals();
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({
        title: `Deals${dateFilter.preset !== 'all' ? ` — Period: ${dateFilterLabel(dateFilter, t, lang)}` : ''}`,
        columns: [
          { key: 'title', header: 'Title' }, { key: 'contact', header: 'Contact' },
          { key: 'stage', header: 'Stage' }, { key: 'value', header: 'Value' },
          { key: 'status', header: 'Status' }, { key: 'close', header: 'Close Date' },
        ],
        rows: all.map(d => ({
          title: d.title || '—', contact: d.crm_contacts?.name || '—', stage: d.stage || '—',
          value: `SAR ${fmt(d.value)}`, status: d.status || '—', close: d.expected_close_date || '—',
        })),
        lang, fileName: 'deals-report.pdf', action,
      });
    } catch (e) { toast('Report generation failed', 'error'); }
    finally { setReportBusy(''); }
  }

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
        <h1 className="text-2xl font-bold text-[color:var(--tx)]">{t('opportunities')}</h1>
        <div className="flex items-center gap-2">
          <GlassButton variant="secondary" onClick={() => runReport('print')} disabled={!data?.total || !!reportBusy}>{reportBusy === 'print' ? '…' : t('print')}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runReport('save')} disabled={!data?.total || !!reportBusy}>⇩ {reportBusy === 'save' ? '…' : t('downloadPdf')}</GlassButton>
          <GlassButton onClick={() => setShowForm(true)}>+ New Deal</GlassButton>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Pipeline Value" value={kpiRows == null ? '—' : `SAR ${fmt(kpiTotalValue)}`} icon="chart" tone="cyan" />
        <MetricCard label="Open Deals" value={kpiRows == null ? '—' : kpiOpen} icon="flag" tone="amber" />
        <MetricCard label="Won" value={kpiRows == null ? '—' : kpiWon} icon="gem" tone="emerald" />
        <MetricCard label="Lost" value={kpiRows == null ? '—' : kpiLost} icon="x" tone="red" />
      </div>

      <GlassCard>
        <div className="flex flex-wrap gap-3 mb-4">
          <GlassInput placeholder="Search deal title…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1 min-w-48" />
          <GlassSelect value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </GlassSelect>
          <DateFilter value={dateFilter} onChange={v => { setDateFilter(v); setPage(1); }} t={t} lang={lang} />
        </div>

        {!data ? (
          <GlassSkeletonRows rows={6} cols={6} />
        ) : !deals.length && !search && !status ? (
          <CRMEmptyState
            title="No deals yet"
            text="Create your first deal to start tracking your sales pipeline."
            actionLabel="+ New Deal"
            onAction={() => setShowForm(true)}
          />
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--bd)]">
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
              <tr key={d.id} className="border-b border-[color:var(--bd)] hover:bg-[color:var(--pr-soft)]">
                <GlassTd>
                  <Link href={`/deals/${d.id}`} className="text-[color:var(--pr)] hover:text-[color:var(--pr-2)] font-medium">{d.title}</Link>
                </GlassTd>
                <GlassTd className="text-[color:var(--tx-3)]">{d.crm_contacts?.name || '—'}</GlassTd>
                <GlassTd><GlassBadge tone="neutral">{d.stage}</GlassBadge></GlassTd>
                <GlassTd className="font-medium text-[color:var(--tx)]" dir="ltr">SAR {fmt(d.value)}</GlassTd>
                <GlassTd><GlassBadge tone={statusTone(d.status)}>{d.status}</GlassBadge></GlassTd>
                <GlassTd className="text-[color:var(--tx-3)]">{d.expected_close_date || '—'}</GlassTd>
                <GlassTd>
                  <div className="flex gap-1">
                    {d.status === 'Open' && <GlassButton variant="secondary" size="sm" onClick={() => markWon(d.id)}>Won</GlassButton>}
                    <GlassButton variant="danger" size="sm" onClick={() => del(d.id)}>Del</GlassButton>
                  </div>
                </GlassTd>
              </tr>
            ))}
            {!deals.length && (
              <tr><td colSpan={7} className="text-center text-[color:var(--tx-4)] py-8">No deals found.</td></tr>
            )}
          </tbody>
        </table>
        )}

        <GlassPagination page={page} pageSize={pageSize} total={data?.total || 0} onPage={setPage}
          onPageSize={v => { setPageSize(v); setPage(1); }} />
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
