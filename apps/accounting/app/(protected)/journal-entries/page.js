'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassTh, GlassTd, toast } from '@/components/glass';
import { exportReportPdf } from '@/lib/reportPdf';
import DateFilter, { dateFilterLabel } from '@/components/DateFilter';
import { resolveDateRange } from '@/lib/resolveDateRange';
import ListPagination from '@/components/ListPagination';
import { useLanguage } from '@/lib/i18n';

const STATUSES = ['Draft', 'Posted', 'Voided'];

function statusTone(s) { return s === 'Posted' ? 'success' : s === 'Voided' ? 'error' : 'neutral'; }
function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

export default function JournalEntriesPage() {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: null, to: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [reportBusy, setReportBusy] = useState('');
  const { from: dateFrom, to: dateTo } = resolveDateRange(dateFilter);

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) p.set('search', search);
    if (status) p.set('status', status);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    return p;
  }, [page, pageSize, search, status, dateFrom, dateTo]);
  const { data } = useLiveData(`/api/journal-entries?${params}`, 15000);
  const entries = data?.entries || [];
  const total = Number(data?.total) || 0;

  /* Same shared A4 report engine as the rest of Accounting. Walks every
     server page (500 at a time) under the active filters instead of only
     exporting the currently visible page. */
  async function fetchAllEntries() {
    const all = [];
    for (let p = 1, guard = 0; guard < 100; guard += 1) {
      const qp = new URLSearchParams(params); qp.set('page', String(p)); qp.set('pageSize', '500');
      const res = await fetch(`/api/journal-entries?${qp}`, { credentials: 'same-origin' });
      const body = await res.json().catch(() => ({}));
      const batch = Array.isArray(body.entries) ? body.entries : [];
      all.push(...batch);
      if (!batch.length || batch.length < 500 || all.length >= Number(body.total || 0)) break;
      p += 1;
    }
    return all;
  }

  async function runReport(action) {
    setReportBusy(action);
    try {
      const all = await fetchAllEntries();
      await exportReportPdf({
        title: 'Journal Entries Report' + (status ? ` — ${status}` : '') + (dateFilter.preset !== 'all' ? ` — Period: ${dateFilterLabel(dateFilter, t, lang)}` : '') + (search.trim() ? ` — Search: "${search.trim()}"` : ''),
        columns: [
          { key: 'journal_number', header: 'Number' }, { key: 'entry_date', header: 'Date' },
          { key: 'description', header: 'Description' }, { key: 'debitText', header: 'Debit' }, { key: 'status', header: 'Status' },
        ],
        rows: all.map(e => ({ ...e, journal_number: e.journal_number || String(e.id).slice(0, 8), description: e.description || '—', debitText: `SAR ${fmt(e.total_debit)}` })),
        totals: [['Entries exported', String(all.length)]],
        fileName: 'journal-entries-report.pdf', action,
      });
    } catch (e) { toast(e.message || 'Could not generate report.', 'error'); }
    finally { setReportBusy(''); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Journal Entries</h1>
        <Link href="/journal-entries/new">
          <GlassButton>+ New Entry</GlassButton>
        </Link>
      </div>

      <GlassCard>
        <div className="flex gap-3 mb-4">
          <GlassInput placeholder="Search number or description…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1" />
          <GlassSelect value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </GlassSelect>
          <DateFilter value={dateFilter} onChange={v => { setDateFilter(v); setPage(1); }} t={t} lang={lang} />
          <GlassButton variant="secondary" onClick={() => runReport('print')} disabled={!total || !!reportBusy}>{reportBusy === 'print' ? 'Preparing…' : 'Print'}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runReport('save')} disabled={!total || !!reportBusy}>{reportBusy === 'save' ? 'Generating…' : 'Download PDF'}</GlassButton>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <GlassTh>Number</GlassTh>
              <GlassTh>Date</GlassTh>
              <GlassTh>Description</GlassTh>
              <GlassTh>Debit</GlassTh>
              <GlassTh>Status</GlassTh>
              <GlassTh></GlassTh>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-b border-white/5 hover:bg-white/5">
                <GlassTd className="font-mono">{e.journal_number || e.id.slice(0, 8)}</GlassTd>
                <GlassTd>{e.entry_date}</GlassTd>
                <GlassTd className="text-slate-400">{e.description || '—'}</GlassTd>
                <GlassTd>SAR {fmt(e.total_debit)}</GlassTd>
                <GlassTd><GlassBadge tone={statusTone(e.status)}>{e.status}</GlassBadge></GlassTd>
                <GlassTd>
                  <Link href={`/journal-entries/${e.id}`}>
                    <GlassButton variant="secondary" size="sm">View</GlassButton>
                  </Link>
                </GlassTd>
              </tr>
            ))}
            {!entries.length && (
              <tr><td colSpan={6} className="text-center text-slate-500 py-8">No entries found.</td></tr>
            )}
          </tbody>
        </table>

        <ListPagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={v => { setPageSize(v); setPage(1); }} label="journal entries" />
      </GlassCard>
    </div>
  );
}
