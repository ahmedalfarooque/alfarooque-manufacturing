'use client';

import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useLanguage, trEnum } from '@/lib/i18n';
import { Input, EmptyState, Th, Td, Button } from '@/components/ui';
import DateFilter, { inDateFilter } from '@/components/shared/DateFilter';
import ListPager from '@/components/shared/ListPager';

const QUOTE_STATUSES = ['new', 'contacted', 'quoted', 'converted', 'closed'];
export const QUOTE_STATUS_BADGE = {
  new: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  contacted: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  quoted: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  converted: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  closed: 'bg-slate-500/10 text-slate-500',
};
const REFRESH_MS = 15000;
function label(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

export default function QuotesPage() {
  const { t, lang } = useLanguage();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState('All');
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: null, to: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [busyId, setBusyId] = useState(null);
  const [reportBusy, setReportBusy] = useState('');

  const { data, error, refresh } = useLiveData('/api/quotes', REFRESH_MS);
  const allRows = data?.quotes || [];
  const softDeleteEnabled = data?.softDeleteEnabled !== false;

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return allRows.filter(r => {
      if (status !== 'All' && r.status !== status) return false;
      if (!inDateFilter(dateFilter, r.created_at)) return false;
      if (!q) return true;
      return [r.name, r.email, r.product].filter(Boolean).some(s => String(s).toLowerCase().includes(q));
    });
  }, [allRows, status, dateFilter, debouncedSearch]);

  /* Newest-first over the complete filtered dataset, before pagination. */
  const sorted = useMemo(() => [...filtered].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))), [filtered]);
  const total = sorted.length;
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [debouncedSearch, status, dateFilter]);

  async function deleteQuote(id) {
    if (!confirm(t('oq.confirmDeleteQuote'))) return;
    setBusyId(id);
    const res = await fetch('/api/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ action: 'delete', id }),
    }).catch(() => null);
    setBusyId(null);
    if (res && res.ok) refresh();
  }

  async function runReport(action) {
    setReportBusy(action);
    try {
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({
        title: t('oq.quotesTitle'),
        columns: [
          { key: 'name', header: t('oq.col.name') }, { key: 'contact', header: t('oq.col.contact') },
          { key: 'product', header: t('oq.col.product') }, { key: 'status', header: t('oq.col.status') }, { key: 'date', header: t('oq.col.date') },
        ],
        rows: sorted.map(r => ({
          name: r.name || '—', contact: r.email || r.phone || '—', product: r.product || '—',
          status: trEnum(t, 'status', r.status), date: new Date(r.created_at).toLocaleDateString(),
        })),
        lang, fileName: 'quotes-report.pdf', action,
      });
    } catch (e2) {} finally { setReportBusy(''); }
  }

  return (
    <Shell active="/quotes">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-semibold">{t('oq.quotesTitle')}</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => runReport('print')} disabled={!sorted.length || !!reportBusy}>{reportBusy === 'print' ? '…' : t('common.print')}</Button>
          <Button variant="ghost" onClick={() => runReport('save')} disabled={!sorted.length || !!reportBusy}>⇩ {reportBusy === 'save' ? '…' : t('common.exportPdf')}</Button>
        </div>
      </div>

      <div className="glass-card glass-card--pad mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 items-start">
        <Input placeholder={t('oq.searchQuotesPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="col-span-2" />
        <Dropdown value={status} onChange={setStatus} options={['All', ...QUOTE_STATUSES].map(s => [s, s === 'All' ? t('common.all') : trEnum(t, 'status', s)])} />
        <DateFilter value={dateFilter} onChange={setDateFilter} t={t} lang={lang} />
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="glass-card overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl border-b border-[color:var(--bd)]">
              <tr>
                <Th>{t('oq.col.name')}</Th>
                <Th>{t('oq.col.contact')}</Th>
                <Th>{t('oq.col.product')}</Th>
                <Th>{t('oq.col.status')}</Th>
                <Th>{t('oq.col.date')}</Th>
                <Th className="text-end">{t('common.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-[color:var(--tx-3)]">{t('common.loading')}</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={6}><EmptyState text={t('oq.noQuotesFound')} /></td></tr>
              ) : pageRows.map(r => (
                <tr key={r.id} onClick={() => { window.location.href = '/quotes/' + r.id; }}
                  className="cursor-pointer transition-colors duration-150 hover:bg-[color:var(--pr-soft)]">
                  <Td>{r.name || '—'}</Td>
                  <Td className="max-w-[180px] truncate"><span dir="ltr">{r.email || r.phone || '—'}</span></Td>
                  <Td className="max-w-[160px] truncate">{r.product || '—'}</Td>
                  <Td><span className={'px-2 py-1 rounded-full text-xs font-medium capitalize ' + (QUOTE_STATUS_BADGE[r.status] || '')}>{trEnum(t, 'status', r.status)}</span></Td>
                  <Td>{new Date(r.created_at).toLocaleDateString()}</Td>
                  <Td className="text-end whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                      <a href={'/quotes/' + r.id} className="text-brand-600 dark:text-brand-400 hover:underline text-sm">{t('oq.view')}</a>
                      {softDeleteEnabled && (
                        <button disabled={busyId === r.id} onClick={() => deleteQuote(r.id)} className="text-[#ef4444] hover:underline text-sm disabled:opacity-50 disabled:cursor-not-allowed">{t('oq.delete')}</button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ListPager page={page} pageSize={pageSize} total={total} shownCount={pageRows.length}
        onPageChange={setPage} onPageSizeChange={v => { setPageSize(v); setPage(1); }} t={t} />
    </Shell>
  );
}
