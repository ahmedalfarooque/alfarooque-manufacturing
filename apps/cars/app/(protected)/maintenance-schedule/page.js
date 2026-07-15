'use client';

import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { useLanguage, trEnum } from '@/lib/i18n';
import {
  GlassPage, GlassButton, GlassDropdown, GlassSearch, GlassStatusChip,
  GlassThead, GlassTr, GlassTd, GlassField, GlassInput, GlassTextarea, GlassModal, GlassEmptyState, GlassLoader,
} from '@/components/glass';

const STATUS_TONE = { Healthy: 'emerald', Upcoming: 'amber', Overdue: 'red' };
const TH = 'text-start px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-[var(--tx-4)] font-semibold whitespace-nowrap';
const THsort = TH + ' cursor-pointer select-none hover:text-[var(--pr-2)] transition-colors';

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

  const filtered = useMemo(() => (items || []).filter(m =>
    !debouncedSearch || m.vehicle_number?.toLowerCase().includes(debouncedSearch.toLowerCase()) || m.maintenance_type?.toLowerCase().includes(debouncedSearch.toLowerCase())
  ), [items, debouncedSearch]);
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

  const SortTh = ({ col, label }) => (
    <th onClick={() => toggleSort(col)} className={THsort}>{label}<SortIndicator column={col} sortKey={sortKey} sortDir={sortDir} /></th>
  );

  return (
    <Shell active="/maintenance-schedule">
      <GlassPage title={t('maintSchedule.title')} subtitle={t('maintSchedule.subtitle')}>
        <GlassSearch className="max-w-sm" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('maintSchedule.searchPlaceholder')} />
        {error && <div className="text-[#F87171] text-sm">{error}</div>}

        <div className="glass-card !rounded-[22px] overflow-auto max-h-[70vh]">
          <table className="w-full min-w-[800px]">
            <GlassThead>
              <tr>
                <SortTh col="vehicle_number" label={t('maintSchedule.colVehicle')} />
                <SortTh col="maintenance_type" label={t('maintSchedule.colType')} />
                <SortTh col="last_service_km" label={t('maintSchedule.colLastService')} />
                <SortTh col="interval_km" label={t('maintSchedule.colInterval')} />
                <SortTh col="next_due_km" label={t('maintSchedule.colNextDue')} />
                <SortTh col="remaining_km" label={t('maintSchedule.colRemaining')} />
                <SortTh col="status" label={t('maintSchedule.colStatus')} />
                {isAdmin && <th className={TH + ' text-end'}>{t('maintSchedule.colActions')}</th>}
              </tr>
            </GlassThead>
            <tbody>
              {!items ? (
                <tr><td colSpan={8}><GlassLoader label={t('maintSchedule.loading')} /></td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={8}><GlassEmptyState text={t('maintSchedule.noMatch')} /></td></tr>
              ) : pageRows.map(m => (
                <GlassTr key={m.id}>
                  <GlassTd className="font-semibold !text-[var(--tx)]">{m.vehicle_number}</GlassTd>
                  <GlassTd>{m.maintenance_type}</GlassTd>
                  <GlassTd>{fmt(m.last_service_km)}</GlassTd>
                  <GlassTd>{fmt(m.interval_km)}</GlassTd>
                  <GlassTd>{fmt(m.next_due_km)}</GlassTd>
                  <GlassTd className={m.remaining_km < 0 ? '!text-[#F87171]' : ''}>{fmt(m.remaining_km)} {t('common.km')}</GlassTd>
                  <GlassTd><GlassStatusChip label={trEnum(t, 'status', m.status)} tone={STATUS_TONE[m.status] || 'slate'} /></GlassTd>
                  {isAdmin && (
                    <GlassTd className="text-end whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <IconBtn title={t('maintSchedule.edit')} tone="brand" onClick={() => setModal(m)}>✎</IconBtn>
                        <IconBtn title={t('maintSchedule.delete')} tone="red" onClick={() => deleteItem(m.id)}>🗑</IconBtn>
                      </span>
                    </GlassTd>
                  )}
                </GlassTr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-[var(--tx-4)] flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span>{t('maintSchedule.showingEntries', { from: pageRows.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + pageRows.length, total })}</span>
            <div className="flex items-center gap-1.5">
              <span>{t('maintSchedule.rows')}</span>
              <GlassDropdown className="w-24" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PageBtn disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</PageBtn>
            <span className="text-[var(--tx-2)]">{page} / {totalPages}</span>
            <PageBtn disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</PageBtn>
          </div>
        </div>
      </GlassPage>

      {modal && <ScheduleModal item={modal} onClose={() => setModal(null)} onSave={saveItem} />}
    </Shell>
  );
}

function IconBtn({ children, title, onClick, tone }) {
  const color = tone === 'brand' ? 'text-[var(--pr-2)]' : tone === 'red' ? 'text-[#F87171]' : 'text-[var(--tx-4)]';
  return (
    <button onClick={onClick} title={title}
      className={'h-8 w-8 rounded-lg border border-[var(--bd-2)] bg-[var(--nav-bg)] backdrop-blur-xl hover:border-[rgba(37,212,255,0.4)] transition-colors flex items-center justify-center ' + color}>
      {children}
    </button>
  );
}
function PageBtn({ children, disabled, onClick }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className="h-8 min-w-8 px-2 rounded-lg border border-[var(--bd-2)] bg-[var(--nav-bg)] backdrop-blur-xl text-[var(--tx-2)] disabled:opacity-40 hover:border-[rgba(37,212,255,0.4)] hover:text-[var(--pr-2)] transition-colors">
      {children}
    </button>
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
    <GlassModal title={t('maintSchedule.editTitle', { vehicle: item.vehicle_number })} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="text-[#F87171] text-sm">{err}</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <GlassField className="sm:col-span-2" label={t('maintSchedule.type')}><GlassInput value={form.maintenance_type} onChange={set('maintenance_type')} required /></GlassField>
          <GlassField label={t('maintSchedule.lastServiceKm')}><GlassInput type="number" value={form.last_service_km} onChange={set('last_service_km')} /></GlassField>
          <GlassField label={t('maintSchedule.intervalKm')}><GlassInput type="number" value={form.interval_km} onChange={set('interval_km')} /></GlassField>
          <GlassField className="sm:col-span-2" label={t('maintSchedule.notes')}><GlassTextarea value={form.notes} onChange={set('notes')} rows={2} /></GlassField>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <GlassButton type="button" variant="ghost" onClick={onClose}>{t('maintSchedule.cancel')}</GlassButton>
          <GlassButton type="submit" disabled={busy}>{busy ? t('maintSchedule.saving') : t('maintSchedule.save')}</GlassButton>
        </div>
      </form>
    </GlassModal>
  );
}

function fmt(n) { return Number(n || 0).toLocaleString(); }
