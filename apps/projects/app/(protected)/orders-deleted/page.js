'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useLanguage, trEnum } from '@/lib/i18n';
import { Input } from '@/components/ui';

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
  const { t } = useLanguage();
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState(null);
  const [softDeleteEnabled, setSoftDeleteEnabled] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState('All');
  const [recovery, setRecovery] = useState('All');
  const [busyId, setBusyId] = useState(null);

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

  const filtered = rows || [];

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

  return (
    <Shell active="/orders-deleted">
      <h2 className="text-lg font-semibold mb-4">{t('oq.ordersDeletedTitle')}</h2>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input placeholder={t('oq.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
          className="col-span-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
        <Dropdown value={status} onChange={setStatus} options={['All', ...ORDER_STATUSES].map(s => [s, s === 'All' ? t('common.all') : trEnum(t, 'status', s)])} />
        <Dropdown value={recovery} onChange={setRecovery}
          options={RECOVERY_OPTIONS.map(r => [r, r === 'All' ? t('oq.allRecovery') : t('oq.recovery' + r.charAt(0).toUpperCase() + r.slice(1))])} />
      </div>

      {!softDeleteEnabled ? (
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-8 text-center text-slate-400">
          🔒 {t('oq.softDeleteNotEnabled')}
        </div>
      ) : (
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[70vh]">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
              <tr>
                <th className="py-3 px-4">{t('oq.col.orderNo')}</th>
                <th>{t('oq.col.customer')}</th>
                <th>{t('oq.col.email')}</th>
                <th>{t('oq.col.total')}</th>
                <th>{t('oq.col.status')}</th>
                <th>{t('oq.col.deletedBy')}</th>
                <th>{t('oq.col.deletedDate')}</th>
                <th>{t('oq.col.daysRemaining')}</th>
                <th className="text-right px-4">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows === null ? (
                <tr><td colSpan={9} className="py-8 text-center text-slate-400">{t('common.loading')}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-slate-400">{t('oq.noDeletedOrdersFound')}</td></tr>
              ) : filtered.map(r => {
                const name = r.guest_name || r.customer_name || '—';
                const email = r.guest_email || r.customer_email || '—';
                const daysText = r.days_remaining <= 0 ? t('oq.expiresToday') : t('oq.daysLeft', { n: r.days_remaining });
                return (
                  <tr key={r.id} className="border-b border-black/5 dark:border-white/5">
                    <td className="py-3 px-4" dir="ltr">{r.order_no || r.id.slice(0, 8)}</td>
                    <td className="max-w-[160px] truncate">{name}</td>
                    <td className="max-w-[180px] truncate" dir="ltr">{email}</td>
                    <td dir="ltr">{money(r.grand_total)}</td>
                    <td className="capitalize">{trEnum(t, 'status', r.status)}</td>
                    <td>{r.deleted_by_name || '—'}</td>
                    <td>{r.deleted_at ? new Date(r.deleted_at).toLocaleDateString() : '—'}</td>
                    <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + recoveryBadgeClass(r.days_remaining)}>{daysText}</span></td>
                    <td className="text-right px-4 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button disabled={busyId === r.id} onClick={() => recover(r.id)} className="text-xs px-2 py-1 rounded-lg bg-brand-600 text-white disabled:opacity-50">{t('oq.recover')}</button>
                        {isSuperAdmin && (
                          <button disabled={busyId === r.id} onClick={() => permanentDelete(r.id)} className="text-xs px-2 py-1 rounded-lg bg-red-600 text-white disabled:opacity-50">{t('oq.deletePermanently')}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
