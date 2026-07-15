'use client';

import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useLanguage, trEnum } from '@/lib/i18n';
import { GlassButton } from '@/components/glass';

const QUOTE_STATUSES = ['new', 'contacted', 'quoted', 'converted', 'closed'];
export const QUOTE_STATUS_BADGE = {
  new: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  contacted: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  quoted: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  converted: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  closed: 'bg-slate-500/10 text-slate-500',
};
const REFRESH_MS = 15000;

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

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input placeholder={t('oq.searchQuotesPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
          className="col-span-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
        <Dropdown value={status} onChange={setStatus} options={['All', ...QUOTE_STATUSES].map(s => [s, s === 'All' ? t('common.all') : trEnum(t, 'status', s)])} />
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th className="py-3 px-4">{t('oq.col.name')}</th>
              <th>{t('oq.col.contact')}</th>
              <th>{t('oq.col.product')}</th>
              <th>{t('oq.col.status')}</th>
              <th>{t('oq.col.date')}</th>
              <th className="text-right px-4">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">{t('common.loading')}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">{t('oq.noQuotesFound')}</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} onClick={() => { window.location.href = '/quotes/' + r.id; }}
                className="border-b border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                <td className="py-3 px-4">{r.name || '—'}</td>
                <td className="max-w-[180px] truncate" dir="ltr">{r.email || r.phone || '—'}</td>
                <td className="max-w-[160px] truncate">{r.product || '—'}</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium capitalize ' + (QUOTE_STATUS_BADGE[r.status] || '')}>{trEnum(t, 'status', r.status)}</span></td>
                <td>{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="text-right px-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    <a href={'/quotes/' + r.id} className="af-btn af-btn--secondary text-xs px-2 py-1">{t('oq.view')}</a>
                    {softDeleteEnabled && (
                      <GlassButton variant="danger" className="text-xs px-2 py-1" disabled={busyId === r.id} onClick={() => deleteQuote(r.id)}>{t('oq.delete')}</GlassButton>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
