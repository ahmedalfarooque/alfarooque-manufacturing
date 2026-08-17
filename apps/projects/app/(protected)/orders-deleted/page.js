'use client';

import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useLanguage, trEnum } from '@/lib/i18n';
import { Input, Button } from '@/components/ui';
import DateFilter, { inDateFilter } from '@/components/shared/DateFilter';
import ListPager from '@/components/shared/ListPager';

function money(n) { return 'SAR ' + Number(n || 0).toLocaleString('en-US'); }
function label(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function recoveryBadgeClass(days) {
  if (days > 14) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  if (days > 3) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return 'bg-red-500/10 text-red-600 dark:text-red-400';
}

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'manufacturing', 'quality_check', 'packed', 'ready', 'shipped', 'out_for_delivery', 'delivered', 'completed', 'cancelled', 'returned', 'rejected'];
const RECOVERY_OPTIONS = ['All', 'green', 'orange', 'red'];

export default function DeletedOrdersPage() {
  const { t, lang } = useLanguage();
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState(null);
  const [softDeleteEnabled, setSoftDeleteEnabled] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState('All');
  const [recovery, setRecovery] = useState('All');
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: null, to: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [busyId, setBusyId] = useState(null);
  const [reportBusy, setReportBusy] = useState('');

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);

  function load() {
    const q = new URLSearchParams({ deleted: '1' });
    if (debouncedSearch.trim()) q.set('search', debouncedSearch.trim());
    if (status !== 'All') q.set('status', status);
    if (recovery !== 'All') q.set('recovery', recovery);
    fetch('/api/orders?' + q.toString(), { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setRows(d.orders || []); setSoftDeleteEnabled(d.softDeleteEnabled !== false); })
      .catch(() => setRows([]));
  }
  useEffect(() => { load(); }, [debouncedSearch, status, recovery]);
  useEffect(() => { setPage(1); }, [debouncedSearch, status, recovery, dateFilter]);

  /* Date filter runs client-side (the API has no date-range params) on
     top of the server's already newest-first (deleted_at desc) result. */
  const filtered = useMemo(() => (rows || []).filter(r => inDateFilter(dateFilter, r.deleted_at)), [rows, dateFilter]);
  const total = filtered.length;
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function recover(id) {
    setBusyId(id);
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ action: 'recover', id }),
    }).catch(() => null);
    setBusyId(null);
    if (res && res.ok) load();
  }

  async function permanentDelete(id) {
    if (!confirm(t('oq.confirmPermanentDelete'))) return;
    setBusyId(id);
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ action: 'permanent-delete', id }),
    }).catch(() => null);
    setBusyId(null);
    if (res && res.ok) load(); else { const d = res ? await res.json().catch(() => ({})) : {}; alert(d.error || t('common.genericError')); }
  }

  const isSuperAdmin = me?.role === 'admin';

  async function runReport(action) {
    setReportBusy(action);
    try {
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({
        title: t('oq.ordersDeletedTitle'),
        columns: [
          { key: 'orderNo', header: t('oq.col.orderNo') }, { key: 'customer', header: t('oq.col.customer') },
          { key: 'total', header: t('oq.col.total') }, { key: 'status', header: t('oq.col.status') },
          { key: 'deletedBy', header: t('oq.col.deletedBy') }, { key: 'deletedDate', header: t('oq.col.deletedDate') },
        ],
        rows: filtered.map(r => ({
          orderNo: r.order_no || r.id.slice(0, 8), customer: r.guest_name || r.customer_name || '—', total: money(r.grand_total),
          status: trEnum(t, 'status', r.status), deletedBy: r.deleted_by_name || '—',
          deletedDate: r.deleted_at ? new Date(r.deleted_at).toLocaleDateString() : '—',
        })),
        lang, fileName: 'deleted-orders-report.pdf', action,
      });
    } catch (e2) {} finally { setReportBusy(''); }
  }

  return (
    <Shell active="/orders-deleted">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-lg font-semibold">{t('oq.ordersDeletedTitle')}</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => runReport('print')} disabled={!filtered.length || !!reportBusy}>{reportBusy === 'print' ? '…' : t('common.print')}</Button>
          <Button variant="ghost" onClick={() => runReport('save')} disabled={!filtered.length || !!reportBusy}>⇩ {reportBusy === 'save' ? '…' : t('common.exportPdf')}</Button>
        </div>
      </div>

      <div className="glass-card glass-card--pad mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Input placeholder={t('oq.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
          className="col-span-2" />
        <Dropdown value={status} onChange={setStatus} options={['All', ...ORDER_STATUSES].map(s => [s, s === 'All' ? t('common.all') : trEnum(t, 'status', s)])} />
        <Dropdown value={recovery} onChange={setRecovery}
          options={RECOVERY_OPTIONS.map(r => [r, r === 'All' ? t('oq.allRecovery') : t('oq.recovery' + r.charAt(0).toUpperCase() + r.slice(1))])} />
        <DateFilter value={dateFilter} onChange={setDateFilter} t={t} lang={lang} />
      </div>

      {!softDeleteEnabled ? (
        <div className="glass-card p-8 text-center text-[color:var(--tx-3)]">
          🔒 {t('oq.softDeleteNotEnabled')}
        </div>
      ) : (
        <div className="glass-card overflow-auto max-h-[70vh]">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="text-left text-[11px] uppercase tracking-wider text-[color:var(--tx-3)] font-medium sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl border-b border-[color:var(--bd)]">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">{t('oq.col.orderNo')}</th>
                <th className="px-3 py-2.5 whitespace-nowrap">{t('oq.col.customer')}</th>
                <th className="px-3 py-2.5 whitespace-nowrap">{t('oq.col.email')}</th>
                <th className="px-3 py-2.5 whitespace-nowrap">{t('oq.col.total')}</th>
                <th className="px-3 py-2.5 whitespace-nowrap">{t('oq.col.status')}</th>
                <th className="px-3 py-2.5 whitespace-nowrap">{t('oq.col.deletedBy')}</th>
                <th className="px-3 py-2.5 whitespace-nowrap">{t('oq.col.deletedDate')}</th>
                <th className="px-3 py-2.5 whitespace-nowrap">{t('oq.col.daysRemaining')}</th>
                <th className="text-right px-4 whitespace-nowrap">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr><td colSpan={9} className="py-8 text-center text-[color:var(--tx-3)]">{t('common.loading')}</td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-[color:var(--tx-3)]">{t('oq.noDeletedOrdersFound')}</td></tr>
              ) : pageRows.map(r => {
                const name = r.guest_name || r.customer_name || '—';
                const email = r.guest_email || r.customer_email || '—';
                const daysText = r.days_remaining <= 0 ? t('oq.expiresToday') : t('oq.daysLeft', { n: r.days_remaining });
                return (
                  <tr key={r.id} className="border-t border-[color:var(--bd)]">
                    <td className="py-3 px-4" dir="ltr">{r.order_no || r.id.slice(0, 8)}</td>
                    <td className="px-3 py-2.5 max-w-[160px] truncate">{name}</td>
                    <td className="px-3 py-2.5 max-w-[180px] truncate" dir="ltr">{email}</td>
                    <td className="px-3 py-2.5" dir="ltr">{money(r.grand_total)}</td>
                    <td className="px-3 py-2.5 capitalize">{trEnum(t, 'status', r.status)}</td>
                    <td className="px-3 py-2.5">{r.deleted_by_name || '—'}</td>
                    <td className="px-3 py-2.5">{r.deleted_at ? new Date(r.deleted_at).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2.5"><span className={'px-2 py-1 rounded-full text-xs font-medium ' + recoveryBadgeClass(r.days_remaining)}>{daysText}</span></td>
                    <td className="text-right px-4 py-2.5 whitespace-nowrap">
                      <button disabled={busyId === r.id} onClick={() => recover(r.id)} className="text-brand-600 dark:text-brand-400 hover:underline text-sm me-3 disabled:opacity-50">{t('oq.recover')}</button>
                      {isSuperAdmin && (
                        <button disabled={busyId === r.id} onClick={() => permanentDelete(r.id)} className="text-[#ef4444] hover:underline text-sm disabled:opacity-50">{t('oq.deletePermanently')}</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {softDeleteEnabled && (
        <ListPager page={page} pageSize={pageSize} total={total} shownCount={pageRows.length}
          onPageChange={setPage} onPageSizeChange={v => { setPageSize(v); setPage(1); }} t={t} />
      )}
    </Shell>
  );
}
