'use client';

import { useState, useEffect } from 'react';
import { useLiveData } from '@/lib/useLiveData';
import { useLang } from '@/lib/i18n';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassPagination, GlassModal, GlassField, toast, GlassTh, GlassTd, GlassSkeletonRows } from '@/components/glass';
import { MetricCard, CRMEmptyState } from '@/components/CRMWidgets';
import DateFilter, { resolveDateRange, dateFilterLabel } from '@/components/DateFilter';

const STATUSES = ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted', 'Lost'];
function statusTone(s) {
  if (s === 'Qualified' || s === 'Converted') return 'emerald';
  if (s === 'Unqualified' || s === 'Lost') return 'red';
  if (s === 'Contacted') return 'amber';
  return 'cyan';
}

export default function LeadsPage() {
  const { t, lang } = useLang();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: null, to: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ status: 'New' });
  const [saving, setSaving] = useState(false);
  const [reportBusy, setReportBusy] = useState('');
  const [converting, setConverting] = useState(null);
  const { from: dateFrom, to: dateTo } = resolveDateRange(dateFilter);

  const params = new URLSearchParams({ page, pageSize });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const { data, refresh } = useLiveData(`/api/leads?${params}`, 15000);
  const leads = data?.leads || [];

  const [kpiRows, setKpiRows] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setKpiRows(null);
    fetchAllLeads().then(rows => { if (!cancelled) setKpiRows(rows); }).catch(() => { if (!cancelled) setKpiRows([]); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, dateFrom, dateTo, data?.total]);

  const kpiNew = (kpiRows || []).filter(l => l.status === 'New').length;
  const kpiQualified = (kpiRows || []).filter(l => l.status === 'Qualified').length;
  const kpiConverted = (kpiRows || []).filter(l => l.status === 'Converted').length;
  const kpiTotal = kpiRows == null ? '—' : kpiRows.length;

  async function fetchAllLeads() {
    const q = new URLSearchParams({ page: 1, pageSize: 500 });
    if (search) q.set('search', search);
    if (status) q.set('status', status);
    if (dateFrom) q.set('dateFrom', dateFrom);
    if (dateTo) q.set('dateTo', dateTo);
    const first = await fetch(`/api/leads?${q}`).then(r => r.json());
    let rows = first.leads || [];
    const total = first.total || rows.length;
    const totalPages = Math.ceil(total / 500);
    for (let p = 2; p <= totalPages; p++) {
      q.set('page', p);
      const next = await fetch(`/api/leads?${q}`).then(r => r.json());
      rows = rows.concat(next.leads || []);
    }
    return rows;
  }

  async function runReport(action) {
    setReportBusy(action);
    try {
      const all = await fetchAllLeads();
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({
        title: `Leads${dateFilter.preset !== 'all' ? ` — Period: ${dateFilterLabel(dateFilter, t, lang)}` : ''}`,
        columns: [
          { key: 'name', header: 'Name' }, { key: 'company', header: 'Company' },
          { key: 'source', header: 'Source' }, { key: 'status', header: 'Status' },
          { key: 'followUp', header: 'Next Follow-up' },
        ],
        rows: all.map(l => ({
          name: l.name || '—', company: l.company || '—', source: l.source || '—',
          status: l.status || '—', followUp: l.next_follow_up || '—',
        })),
        lang, fileName: 'leads-report.pdf', action,
      });
    } catch (e) { toast('Report generation failed', 'error'); }
    finally { setReportBusy(''); }
  }

  async function create() {
    setSaving(true);
    try {
      const res = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed');
      toast('Lead created', 'success');
      setShowForm(false);
      setForm({ status: 'New' });
      refresh();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  async function convert(id) {
    setConverting(id);
    try {
      const res = await fetch(`/api/leads/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'convert', createDeal: true }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Conversion failed');
      toast('Lead converted to Contact + Opportunity', 'success');
      refresh();
    } catch (e) { toast(e.message, 'error'); }
    finally { setConverting(null); }
  }

  async function del(id) {
    if (!confirm('Delete this lead?')) return;
    const res = await fetch(`/api/leads/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Deleted', 'success'); refresh(); }
    else toast('Delete failed', 'error');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[color:var(--tx)]">Leads</h1>
        <div className="flex items-center gap-2">
          <GlassButton variant="secondary" onClick={() => runReport('print')} disabled={!data?.total || !!reportBusy}>{reportBusy === 'print' ? '…' : t('print')}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runReport('save')} disabled={!data?.total || !!reportBusy}>⇩ {reportBusy === 'save' ? '…' : t('downloadPdf')}</GlassButton>
          <GlassButton onClick={() => setShowForm(true)}>+ New Lead</GlassButton>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Total Leads" value={kpiTotal} icon="target" tone="cyan" />
        <MetricCard label="New" value={kpiRows == null ? '—' : kpiNew} icon="flag" tone="amber" />
        <MetricCard label="Qualified" value={kpiRows == null ? '—' : kpiQualified} icon="gem" tone="emerald" />
        <MetricCard label="Converted" value={kpiRows == null ? '—' : kpiConverted} icon="users" tone="violet" />
      </div>

      <GlassCard>
        <div className="flex flex-wrap gap-3 mb-4">
          <GlassInput placeholder="Search lead name, company, email…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1 min-w-48" />
          <GlassSelect value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </GlassSelect>
          <DateFilter value={dateFilter} onChange={v => { setDateFilter(v); setPage(1); }} t={t} lang={lang} />
        </div>

        {!data ? (
          <GlassSkeletonRows rows={6} cols={6} />
        ) : !leads.length && !search && !status ? (
          <CRMEmptyState
            title="No leads yet"
            text="Add your first lead to start building the top of your sales funnel."
            actionLabel="+ New Lead"
            onAction={() => setShowForm(true)}
          />
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[color:var(--bd)]">
              <GlassTh>Name</GlassTh>
              <GlassTh>Company</GlassTh>
              <GlassTh>Source</GlassTh>
              <GlassTh>Status</GlassTh>
              <GlassTh>Next Follow-up</GlassTh>
              <GlassTh></GlassTh>
            </tr>
          </thead>
          <tbody>
            {leads.map(l => (
              <tr key={l.id} className="border-b border-[color:var(--bd)] hover:bg-[color:var(--pr-soft)]">
                <GlassTd className="font-medium text-[color:var(--tx)]">{l.name}</GlassTd>
                <GlassTd className="text-[color:var(--tx-3)]">{l.company || '—'}</GlassTd>
                <GlassTd className="text-[color:var(--tx-3)]">{l.source || '—'}</GlassTd>
                <GlassTd><GlassBadge tone={statusTone(l.status)}>{l.status}</GlassBadge></GlassTd>
                <GlassTd className="text-[color:var(--tx-3)]">{l.next_follow_up || '—'}</GlassTd>
                <GlassTd>
                  <div className="flex gap-1">
                    {l.status !== 'Converted' && (
                      <GlassButton variant="secondary" size="sm" onClick={() => convert(l.id)} disabled={converting === l.id}>
                        {converting === l.id ? '…' : 'Convert'}
                      </GlassButton>
                    )}
                    <GlassButton variant="danger" size="sm" onClick={() => del(l.id)}>Del</GlassButton>
                  </div>
                </GlassTd>
              </tr>
            ))}
            {!leads.length && (
              <tr><td colSpan={6} className="text-center text-[color:var(--tx-4)] py-8">No leads found.</td></tr>
            )}
          </tbody>
        </table>
        )}

        <GlassPagination page={page} pageSize={pageSize} total={data?.total || 0} onPage={setPage}
          onPageSize={v => { setPageSize(v); setPage(1); }} />
      </GlassCard>

      {showForm && (
        <GlassModal title="New Lead" onClose={() => setShowForm(false)} footer={
          <div className="flex gap-2 justify-end">
            <GlassButton variant="secondary" onClick={() => setShowForm(false)}>Cancel</GlassButton>
            <GlassButton onClick={create} disabled={saving}>{saving ? 'Creating…' : 'Create'}</GlassButton>
          </div>
        }>
          <div className="grid grid-cols-2 gap-4">
            <GlassField label="Lead Name" required>
              <GlassInput value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </GlassField>
            <GlassField label="Company">
              <GlassInput value={form.company || ''} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
            </GlassField>
            <GlassField label="Contact Person">
              <GlassInput value={form.contact_person || ''} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} />
            </GlassField>
            <GlassField label="Phone">
              <GlassInput value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </GlassField>
            <GlassField label="Email">
              <GlassInput type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </GlassField>
            <GlassField label="Source">
              <GlassInput value={form.source || ''} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="Website, Referral, Event…" />
            </GlassField>
            <GlassField label="City">
              <GlassInput value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </GlassField>
            <GlassField label="Next Follow-up">
              <GlassInput type="date" value={form.next_follow_up || ''} onChange={e => setForm(f => ({ ...f, next_follow_up: e.target.value }))} />
            </GlassField>
            <GlassField label="Notes" className="col-span-2">
              <GlassInput value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </GlassField>
          </div>
        </GlassModal>
      )}
    </div>
  );
}
