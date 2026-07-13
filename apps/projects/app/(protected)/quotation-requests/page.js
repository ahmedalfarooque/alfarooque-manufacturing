'use client';

import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import StatCard from '@/components/StatCard';
import { useLanguage, trEnum } from '@/lib/i18n';

export const STATUS_BADGE = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  accepted: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  on_hold: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
};
const ALL_STATUSES = ['pending', 'accepted', 'on_hold', 'rejected'];
const REFRESH_MS = 15000;

function money(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }); }

export default function QuotationRequestsPage() {
  const { t } = useLanguage();
  const [me, setMe] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [busyId, setBusyId] = useState(null);

  const isAdmin = me?.role === 'admin';
  const { data, error, refresh } = useLiveData('/api/quotation-requests', REFRESH_MS);
  const allRows = data?.quotationRequests || [];

  /* Dashboard cards deep-link here with ?status=... (Update 1). */
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('status');
    if (fromUrl && ALL_STATUSES.includes(fromUrl)) setStatus(fromUrl);
  }, []);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return allRows.filter(r => {
      if (status !== 'All' && r.status !== status) return false;
      if (!q) return true;
      return [r.quote_number, r.customer_name, r.requested_by_name].filter(Boolean).some(s => s.toLowerCase().includes(q));
    });
  }, [allRows, status, debouncedSearch]);

  const { sorted: rows, sortKey, sortDir, toggleSort } = useSortableData(filtered);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  const kpis = useMemo(() => {
    const c = {};
    ALL_STATUSES.forEach(s => { c[s] = 0; });
    allRows.forEach(r => { c[r.status] = (c[r.status] || 0) + 1; });
    return c;
  }, [allRows]);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);
  useEffect(() => { setPage(1); }, [debouncedSearch, status]);

  async function setRequestStatus(id, next) {
    setBusyId(id);
    const res = await fetch(`/api/quotation-requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ status: next }),
    }).catch(() => null);
    setBusyId(null);
    if (res && res.ok) refresh();
  }

  async function startProject(id) {
    if (busyId) return; // guard against double-click while a request is already in flight
    setBusyId(id);
    const res = await fetch(`/api/quotation-requests/${id}/start-project`, { method: 'POST', credentials: 'same-origin' }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusyId(null);
    if (!res || !res.ok) { alert(d.error || t('common.genericError')); return; }
    refresh();
    if (d.project?.id) window.location.href = '/projects/' + d.project.id;
  }

  async function deleteRequest(id) {
    if (!confirm(t('qr.deleteConfirm'))) return;
    const res = await fetch(`/api/quotation-requests/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) refresh();
  }

  if (!isAdmin && me) return <Shell active="/quotation-requests"><div className="text-red-500 text-sm">{t('qr.adminOnly')}</div></Shell>;

  return (
    <Shell active="/quotation-requests">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('qr.title')}</h2>
          <p className="text-xs text-slate-500">{t('qr.breadcrumb')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon="clock" tone="amber" label={t('qr.kpi.pending')} value={kpis.pending} onClick={() => setStatus('pending')} />
        <StatCard icon="target" tone="emerald" label={t('qr.kpi.accepted')} value={kpis.accepted} onClick={() => setStatus('accepted')} />
        <StatCard icon="clock" tone="amber" label={t('qr.kpi.onHold')} value={kpis.on_hold} onClick={() => setStatus('on_hold')} />
        <StatCard icon="x" tone="red" label={t('qr.kpi.rejected')} value={kpis.rejected} onClick={() => setStatus('rejected')} />
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input placeholder={t('qr.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
          className="col-span-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
        <Dropdown value={status} onChange={setStatus} options={['All', ...ALL_STATUSES].map(s => [s, s === 'All' ? t('common.all') : trEnum(t, 'status', s)])} />
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th className="py-3 px-4">#</th>
              <th onClick={() => toggleSort('quote_number')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('qr.col.quoteNumber')}<SortIndicator column="quote_number" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('customer_name')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('qr.col.customer')}<SortIndicator column="customer_name" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('amount')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('qr.col.amount')}<SortIndicator column="amount" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('quote_date')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('qr.col.date')}<SortIndicator column="quote_date" sortKey={sortKey} sortDir={sortDir} /></th>
              <th>{t('qr.col.currentStatus')}</th>
              <th onClick={() => toggleSort('status')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('qr.col.projectStatus')}<SortIndicator column="status" sortKey={sortKey} sortDir={sortDir} /></th>
              <th className="text-right px-4">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">{t('common.loading')}</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">{t('qr.noMatch')}</td></tr>
            ) : pageRows.map((r, i) => (
              <tr key={r.id} onClick={() => { window.location.href = '/quotation-requests/' + r.id; }}
                className="border-b border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors duration-150">
                <td className="py-3 px-4">{(page - 1) * pageSize + i + 1}</td>
                <td dir="ltr">{r.quote_number}</td>
                <td className="max-w-[160px] truncate">{r.customer_name || '—'}</td>
                <td dir="ltr">{money(r.amount)}</td>
                <td>{r.quote_date || '—'}</td>
                <td className="capitalize">{(r.quotation_status || '—').replace(/_/g, ' ')}</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium capitalize ' + (STATUS_BADGE[r.status] || '')}>{trEnum(t, 'status', r.status)}</span></td>
                <td className="text-right px-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2 flex-wrap">
                    {r.status === 'pending' && (
                      <>
                        <button disabled={busyId === r.id} onClick={() => setRequestStatus(r.id, 'accepted')} className="text-xs px-2 py-1 rounded-lg bg-emerald-600 text-white disabled:opacity-50">{t('qr.accept')}</button>
                        <button disabled={busyId === r.id} onClick={() => setRequestStatus(r.id, 'on_hold')} className="text-xs px-2 py-1 rounded-lg bg-amber-600 text-white disabled:opacity-50">{t('qr.hold')}</button>
                        <button disabled={busyId === r.id} onClick={() => setRequestStatus(r.id, 'rejected')} className="text-xs px-2 py-1 rounded-lg bg-red-600 text-white disabled:opacity-50">{t('qr.reject')}</button>
                      </>
                    )}
                    {['accepted', 'on_hold'].includes(r.status) && !r.project_id && (
                      <button disabled={busyId === r.id} onClick={() => startProject(r.id)} className="text-xs px-2 py-1 rounded-lg bg-brand-600 text-white disabled:opacity-50">{t('qr.projectStart')}</button>
                    )}
                    {r.project_id && (
                      <a href={'/projects/' + r.project_id} className="text-xs px-2 py-1 rounded-lg border border-black/10 dark:border-white/10">↗ {t('qr.openProject')}</a>
                    )}
                    <button onClick={() => deleteRequest(r.id)} title={t('common.delete')} className="text-red-500">🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-slate-500 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span>{t('common.showingEntries', { from: pageRows.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + pageRows.length, total })}</span>
          <div className="flex items-center gap-1.5">
            <span>{t('common.rows')}</span>
            <Dropdown className="w-20" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          </div>
        </div>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">‹</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">›</button>
        </div>
      </div>
    </Shell>
  );
}
