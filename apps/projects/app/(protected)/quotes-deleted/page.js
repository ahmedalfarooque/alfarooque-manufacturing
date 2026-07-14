'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useLanguage, trEnum } from '@/lib/i18n';
import { Input, Th, Td } from '@/components/ui';

const QUOTE_STATUSES = ['new', 'contacted', 'quoted', 'converted', 'closed'];
const RECOVERY_OPTIONS = ['All', 'green', 'orange', 'red'];

function label(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function recoveryBadgeClass(days) {
  if (days > 14) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  if (days > 3) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  return 'bg-red-500/10 text-red-600 dark:text-red-400';
}

export default function DeletedQuotesPage() {
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
    fetch('/api/quotes?' + q.toString(), { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setRows(d.quotes || []); setSoftDeleteEnabled(d.softDeleteEnabled !== false); })
      .catch(() => setRows([]));
  }
  useEffect(() => { load(); }, [debouncedSearch, status, recovery]);

  const filtered = rows || [];

  async function recover(id) {
    setBusyId(id);
    const res = await fetch('/api/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ action: 'recover', id }),
    }).catch(() => null);
    setBusyId(null);
    if (res && res.ok) load();
  }

  async function permanentDelete(id) {
    if (!confirm(t('oq.confirmPermanentDelete'))) return;
    setBusyId(id);
    const res = await fetch('/api/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ action: 'permanent-delete', id }),
    }).catch(() => null);
    setBusyId(null);
    if (res && res.ok) load(); else { const d = res ? await res.json().catch(() => ({})) : {}; alert(d.error || t('common.genericError')); }
  }

  const isSuperAdmin = me?.role === 'admin';

  return (
    <Shell active="/quotes-deleted">
      <h2 className="text-lg font-semibold mb-4">{t('oq.quotesDeletedTitle')}</h2>

      <div className="glass-card glass-card--pad mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Input placeholder={t('oq.searchQuotesPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="col-span-2" />
        <Dropdown value={status} onChange={setStatus} options={['All', ...QUOTE_STATUSES].map(s => [s, s === 'All' ? t('common.all') : trEnum(t, 'status', s)])} />
        <Dropdown value={recovery} onChange={setRecovery}
          options={RECOVERY_OPTIONS.map(r => [r, r === 'All' ? t('oq.allRecovery') : t('oq.recovery' + r.charAt(0).toUpperCase() + r.slice(1))])} />
      </div>

      {!softDeleteEnabled ? (
        <div className="glass-card p-8 text-center text-[#8C8A80]">
          🔒 {t('oq.softDeleteNotEnabled')}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="sticky top-0 z-10 bg-white dark:bg-[#1B1B14] border-b border-[#E5E2DD]/70 dark:border-white/[0.06]">
                <tr>
                  <Th>{t('oq.col.name')}</Th>
                  <Th>{t('oq.col.contact')}</Th>
                  <Th>{t('oq.col.product')}</Th>
                  <Th>{t('oq.col.status')}</Th>
                  <Th>{t('oq.col.deletedBy')}</Th>
                  <Th>{t('oq.col.deletedDate')}</Th>
                  <Th>{t('oq.col.daysRemaining')}</Th>
                  <Th className="text-end">{t('common.actions')}</Th>
                </tr>
              </thead>
              <tbody>
                {rows === null ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-[#8C8A80]">{t('common.loading')}</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-[#8C8A80]">{t('oq.noDeletedQuotesFound')}</td></tr>
                ) : filtered.map(r => {
                  const daysText = r.days_remaining <= 0 ? t('oq.expiresToday') : t('oq.daysLeft', { n: r.days_remaining });
                  return (
                    <tr key={r.id}>
                      <Td>{r.name || '—'}</Td>
                      <Td className="max-w-[180px] truncate"><span dir="ltr">{r.email || r.phone || '—'}</span></Td>
                      <Td className="max-w-[160px] truncate">{r.product || '—'}</Td>
                      <Td className="capitalize">{trEnum(t, 'status', r.status)}</Td>
                      <Td>{r.deleted_by_name || '—'}</Td>
                      <Td>{r.deleted_at ? new Date(r.deleted_at).toLocaleDateString() : '—'}</Td>
                      <Td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + recoveryBadgeClass(r.days_remaining)}>{daysText}</span></Td>
                      <Td className="text-end whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button disabled={busyId === r.id} onClick={() => recover(r.id)} className="text-brand-600 dark:text-brand-400 hover:underline text-sm disabled:opacity-50 disabled:cursor-not-allowed">{t('oq.recover')}</button>
                          {isSuperAdmin && (
                            <button disabled={busyId === r.id} onClick={() => permanentDelete(r.id)} className="text-[#BC6B4E] hover:underline text-sm disabled:opacity-50 disabled:cursor-not-allowed">{t('oq.deletePermanently')}</button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Shell>
  );
}
