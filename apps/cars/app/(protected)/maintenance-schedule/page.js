'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { useLanguage, trEnum } from '@/lib/i18n';

const STATUS_BADGE = {
  Healthy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Upcoming: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Overdue: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function MaintenanceSchedulePage() {
  const { t } = useLanguage();
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [me, setMe] = useState(null);
  const [modal, setModal] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const isAdmin = me?.role === 'admin';

  function load() {
    fetch('/api/maintenance', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(new Error(d.error))))
      .then(d => setItems(d.items))
      .catch(e => setError(e.message));
  }
  useEffect(load, []);
  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);

  const filtered = (items || []).filter(m =>
    !debouncedSearch || m.vehicle_number?.toLowerCase().includes(debouncedSearch.toLowerCase()) || m.maintenance_type?.toLowerCase().includes(debouncedSearch.toLowerCase())
  );
  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(filtered);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  async function saveItem(form, id) {
    const res = await fetch(`/api/maintenance/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setModal(null);
    load();
  }

  async function deleteItem(id) {
    if (!confirm(t('maintSchedule.confirmDelete'))) return;
    const res = await fetch(`/api/maintenance/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) load();
  }

  return (
    <Shell active="/maintenance-schedule">
      <h2 className="text-lg font-semibold mb-1">{t('maintSchedule.title')}</h2>
      <p className="text-xs text-slate-500 mb-4">{t('maintSchedule.subtitle')}</p>
      <input placeholder={t('maintSchedule.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm mb-4" />
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th onClick={() => toggleSort('vehicle_number')} className="py-3 px-4 cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('maintSchedule.colVehicle')}<SortIndicator column="vehicle_number" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('maintenance_type')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('maintSchedule.colType')}<SortIndicator column="maintenance_type" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('last_service_km')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('maintSchedule.colLastService')}<SortIndicator column="last_service_km" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('interval_km')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('maintSchedule.colInterval')}<SortIndicator column="interval_km" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('next_due_km')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('maintSchedule.colNextDue')}<SortIndicator column="next_due_km" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('remaining_km')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('maintSchedule.colRemaining')}<SortIndicator column="remaining_km" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('status')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('maintSchedule.colStatus')}<SortIndicator column="status" sortKey={sortKey} sortDir={sortDir} /></th>
              {isAdmin && <th className="text-right px-4">{t('maintSchedule.colActions')}</th>}
            </tr>
          </thead>
          <tbody>
            {!items ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">{t('maintSchedule.loading')}</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">{t('maintSchedule.noMatch')}</td></tr>
            ) : pageRows.map(m => (
              <tr key={m.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-3 px-4 font-medium">{m.vehicle_number}</td>
                <td>{m.maintenance_type}</td>
                <td>{fmt(m.last_service_km)}</td>
                <td>{fmt(m.interval_km)}</td>
                <td>{fmt(m.next_due_km)}</td>
                <td className={m.remaining_km < 0 ? 'text-red-500' : ''}>{fmt(m.remaining_km)} {t('common.km')}</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (STATUS_BADGE[m.status] || '')}>{trEnum(t, 'status', m.status)}</span></td>
                {isAdmin && (
                  <td className="text-right px-4 space-x-2">
                    <button onClick={() => setModal(m)} title={t('maintSchedule.edit')} className="text-brand-500">✎ {t('maintSchedule.edit')}</button>
                    <button onClick={() => deleteItem(m.id)} title={t('maintSchedule.delete')} className="text-red-500">🗑 {t('maintSchedule.delete')}</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-slate-500 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span>{t('maintSchedule.showingEntries', { from: pageRows.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + pageRows.length, total })}</span>
          <div className="flex items-center gap-1.5">
            <span>{t('maintSchedule.rows')}</span>
            <Dropdown className="w-20" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          </div>
        </div>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">‹</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">›</button>
        </div>
      </div>

      {modal && <ScheduleModal item={modal} onClose={() => setModal(null)} onSave={saveItem} />}
    </Shell>
  );
}

function ScheduleModal({ item, onClose, onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    maintenance_type: item.maintenance_type || '',
    last_service_km: item.last_service_km ?? '',
    interval_km: item.interval_km ?? '',
    notes: item.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await onSave(form, item.id); }
    catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4">
        <h3 className="font-semibold text-lg">{t('maintSchedule.editTitle', { vehicle: item.vehicle_number })}</h3>
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{t('maintSchedule.type')}</label>
            <input value={form.maintenance_type} onChange={set('maintenance_type')} required className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('maintSchedule.lastServiceKm')}</label>
            <input type="number" value={form.last_service_km} onChange={set('last_service_km')} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('maintSchedule.intervalKm')}</label>
            <input type="number" value={form.interval_km} onChange={set('interval_km')} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{t('maintSchedule.notes')}</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm">{t('maintSchedule.cancel')}</button>
          <button disabled={busy} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm">{busy ? t('maintSchedule.saving') : t('maintSchedule.save')}</button>
        </div>
      </form>
    </div>
  );
}

function fmt(n) { return Number(n || 0).toLocaleString(); }
