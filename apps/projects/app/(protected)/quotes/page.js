'use client';

import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useLanguage, trEnum } from '@/lib/i18n';
import { Input, EmptyState, Th, Td } from '@/components/ui';

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
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState('All');
  const [busyId, setBusyId] = useState(null);

  const { data, error, refresh } = useLiveData('/api/quotes', REFRESH_MS);
  const allRows = data?.quotes || [];
  const softDeleteEnabled = data?.softDeleteEnabled !== false;

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return allRows.filter(r => {
      if (status !== 'All' && r.status !== status) return false;
      if (!q) return true;
      return [r.name, r.email, r.product].filter(Boolean).some(s => String(s).toLowerCase().includes(q));
    });
  }, [allRows, status, debouncedSearch]);

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

  return (
    <Shell active="/quotes">
      <h2 className="text-lg font-semibold mb-4">{t('oq.quotesTitle')}</h2>

      <div className="glass-card glass-card--pad mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Input placeholder={t('oq.searchQuotesPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="col-span-2" />
        <Dropdown value={status} onChange={setStatus} options={['All', ...QUOTE_STATUSES].map(s => [s, s === 'All' ? t('common.all') : trEnum(t, 'status', s)])} />
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
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6}><EmptyState text={t('oq.noQuotesFound')} /></td></tr>
              ) : filtered.map(r => (
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
    </Shell>
  );
}
