'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { useLanguage, trEnum } from '@/lib/i18n';
import { Button, Input, Field, Textarea, Modal, EmptyState, Th, Td } from '@/components/ui';

const STATUS_BADGE = {
  Healthy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Upcoming: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Overdue: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const sortHeaderCls = 'cursor-pointer select-none inline-flex items-center gap-1 hover:text-[color:var(--tx)] transition-colors';

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
      <p className="text-xs text-[color:var(--tx-3)] mb-4">{t('maintSchedule.subtitle')}</p>
      <Input placeholder={t('maintSchedule.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm mb-4" />
      {error && <div className="text-[#ef4444] text-sm">{error}</div>}
      <div className="glass-card overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl border-b border-[color:var(--bd)]">
            <tr>
              <Th><span onClick={() => toggleSort('vehicle_number')} className={sortHeaderCls}>{t('maintSchedule.colVehicle')}<SortIndicator column="vehicle_number" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('maintenance_type')} className={sortHeaderCls}>{t('maintSchedule.colType')}<SortIndicator column="maintenance_type" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('last_service_km')} className={sortHeaderCls}>{t('maintSchedule.colLastService')}<SortIndicator column="last_service_km" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('interval_km')} className={sortHeaderCls}>{t('maintSchedule.colInterval')}<SortIndicator column="interval_km" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('next_due_km')} className={sortHeaderCls}>{t('maintSchedule.colNextDue')}<SortIndicator column="next_due_km" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('remaining_km')} className={sortHeaderCls}>{t('maintSchedule.colRemaining')}<SortIndicator column="remaining_km" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              <Th><span onClick={() => toggleSort('status')} className={sortHeaderCls}>{t('maintSchedule.colStatus')}<SortIndicator column="status" sortKey={sortKey} sortDir={sortDir} /></span></Th>
              {isAdmin && <Th className="text-end">{t('maintSchedule.colActions')}</Th>}
            </tr>
          </thead>
          <tbody>
            {!items ? (
              <tr><td colSpan={8} className="py-8 text-center text-[color:var(--tx-3)]">{t('maintSchedule.loading')}</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={8}><EmptyState text={t('maintSchedule.noMatch')} /></td></tr>
            ) : pageRows.map(m => (
              <tr key={m.id} className="hover:bg-[color:var(--pr-soft)]">
                <Td className="font-medium">{m.vehicle_number}</Td>
                <Td>{m.maintenance_type}</Td>
                <Td>{fmt(m.last_service_km)}</Td>
                <Td>{fmt(m.interval_km)}</Td>
                <Td>{fmt(m.next_due_km)}</Td>
                <Td className={m.remaining_km < 0 ? 'text-[#ef4444]' : ''}>{fmt(m.remaining_km)} {t('common.km')}</Td>
                <Td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (STATUS_BADGE[m.status] || '')}>{trEnum(t, 'status', m.status)}</span></Td>
                {isAdmin && (
                  <Td className="text-end">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => setModal(m)} title={t('maintSchedule.edit')} className="text-brand-600 dark:text-brand-400 hover:underline">✎ {t('maintSchedule.edit')}</button>
                      <button onClick={() => deleteItem(m.id)} title={t('maintSchedule.delete')} className="text-[#ef4444] hover:underline">🗑 {t('maintSchedule.delete')}</button>
                    </div>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-[color:var(--tx-3)] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span>{t('maintSchedule.showingEntries', { from: pageRows.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + pageRows.length, total })}</span>
          <div className="flex items-center gap-1.5">
            <span>{t('maintSchedule.rows')}</span>
            <Dropdown className="w-20" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          </div>
        </div>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 rounded disabled:opacity-40 hover:bg-[color:var(--pr-soft)]">‹</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-2 py-1 rounded disabled:opacity-40 hover:bg-[color:var(--pr-soft)]">›</button>
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
    <Modal title={t('maintSchedule.editTitle', { vehicle: item.vehicle_number })} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="text-[#ef4444] text-sm">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('maintSchedule.type')} required className="col-span-2">
            <Input value={form.maintenance_type} onChange={set('maintenance_type')} required />
          </Field>
          <Field label={t('maintSchedule.lastServiceKm')}>
            <Input type="number" value={form.last_service_km} onChange={set('last_service_km')} />
          </Field>
          <Field label={t('maintSchedule.intervalKm')}>
            <Input type="number" value={form.interval_km} onChange={set('interval_km')} />
          </Field>
          <Field label={t('maintSchedule.notes')} className="col-span-2">
            <Textarea rows={2} value={form.notes} onChange={set('notes')} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('maintSchedule.cancel')}</Button>
          <Button type="submit" disabled={busy}>{busy ? t('maintSchedule.saving') : t('maintSchedule.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function fmt(n) { return Number(n || 0).toLocaleString(); }
