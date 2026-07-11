'use client';

import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import OrderDetailsModal from '@/components/shared/OrderDetailsModal';
import { useLiveData } from '@/lib/useLiveData';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { useLanguage } from '@/lib/i18n';

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'manufacturing', 'quality_check', 'packed', 'ready', 'shipped', 'out_for_delivery', 'delivered', 'completed', 'cancelled', 'returned', 'rejected'];
export const STATUS_BADGE = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  confirmed: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  processing: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  delivered: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  returned: 'bg-red-500/10 text-red-600 dark:text-red-400',
};
const REFRESH_MS = 15000;
function money(n) { return 'SAR ' + Number(n || 0).toLocaleString('en-US'); }
function label(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

export default function OrdersPage() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState('All');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [busyId, setBusyId] = useState(null);
  const [viewOrderId, setViewOrderId] = useState(null);

  const { data, error, refresh } = useLiveData('/api/orders', REFRESH_MS);
  const allRows = data?.orders || [];
  const softDeleteEnabled = data?.softDeleteEnabled !== false;

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return allRows.filter(r => {
      if (status !== 'All' && r.status !== status) return false;
      if (!q) return true;
      const name = r.guest_name || r.customer_name || '';
      const email = r.guest_email || r.customer_email || '';
      return [r.order_no, name, email].filter(Boolean).some(s => String(s).toLowerCase().includes(q));
    });
  }, [allRows, status, debouncedSearch]);

  const { sorted: rows, sortKey, sortDir, toggleSort } = useSortableData(filtered);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [debouncedSearch, status]);

  async function deleteOrder(id) {
    if (!confirm(t('oq.confirmDeleteOrder'))) return;
    setBusyId(id);
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ action: 'delete', id }),
    }).catch(() => null);
    setBusyId(null);
    if (res && res.ok) refresh();
  }

  return (
    <Shell active="/orders">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('oq.ordersTitle')}</h2>
        </div>
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input placeholder={t('oq.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
          className="col-span-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
        <Dropdown value={status} onChange={setStatus} options={['All', ...ORDER_STATUSES]} />
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th onClick={() => toggleSort('order_no')} className="py-3 px-4 cursor-pointer select-none">{t('oq.col.orderNo')}<SortIndicator column="order_no" sortKey={sortKey} sortDir={sortDir} /></th>
              <th>{t('oq.col.customer')}</th>
              <th>{t('oq.col.email')}</th>
              <th onClick={() => toggleSort('grand_total')} className="cursor-pointer select-none">{t('oq.col.total')}<SortIndicator column="grand_total" sortKey={sortKey} sortDir={sortDir} /></th>
              <th>{t('oq.col.status')}</th>
              <th>{t('oq.col.payment')}</th>
              <th onClick={() => toggleSort('created_at')} className="cursor-pointer select-none">{t('oq.col.date')}<SortIndicator column="created_at" sortKey={sortKey} sortDir={sortDir} /></th>
              <th className="text-right px-4">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">{t('common.loading')}</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">{t('oq.noOrdersFound')}</td></tr>
            ) : pageRows.map(r => {
              const name = r.guest_name || r.customer_name || '—';
              const email = r.guest_email || r.customer_email || '—';
              return (
                <tr key={r.id} onClick={() => setViewOrderId(r.id)}
                  className="border-b border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                  <td className="py-3 px-4" dir="ltr">{r.order_no || r.id.slice(0, 8)}</td>
                  <td className="max-w-[160px] truncate">{name}</td>
                  <td className="max-w-[180px] truncate" dir="ltr">{email}</td>
                  <td dir="ltr">{money(r.grand_total)}</td>
                  <td><span className={'px-2 py-1 rounded-full text-xs font-medium capitalize ' + (STATUS_BADGE[r.status] || '')}>{label(r.status)}</span></td>
                  <td className="capitalize">{label(r.payment_status || 'pending')}</td>
                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="text-right px-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setViewOrderId(r.id)} className="text-xs px-2 py-1 rounded-lg border border-black/10 dark:border-white/10">{t('oq.view')}</button>
                      <a href={'/orders/' + r.id} className="text-xs px-2 py-1 rounded-lg bg-brand-600 text-white">{t('oq.edit')}</a>
                      {softDeleteEnabled && (
                        <button disabled={busyId === r.id} onClick={() => deleteOrder(r.id)} className="text-xs px-2 py-1 rounded-lg bg-red-600 text-white disabled:opacity-50">{t('oq.delete')}</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-slate-500 flex-wrap gap-3">
        <span>{t('common.showingEntries', { from: pageRows.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + pageRows.length, total })}</span>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">‹</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">›</button>
        </div>
      </div>

      {viewOrderId && <OrderDetailsModal orderId={viewOrderId} onClose={() => setViewOrderId(null)} />}
    </Shell>
  );
}
