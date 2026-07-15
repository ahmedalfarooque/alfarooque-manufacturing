'use client';

import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { useLanguage, trEnum } from '@/lib/i18n';
import { Button, Input, Field, Modal, EmptyState, Th, Td } from '@/components/ui';

const STATUS_BADGE = {
  Running: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Idle: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Stopped: 'bg-red-500/10 text-red-600 dark:text-red-400',
  Offline: 'bg-slate-500/10 text-[color:var(--tx-3)]',
};

const SORT_TH = 'text-start px-3 py-2.5 text-[11px] uppercase tracking-wider text-[color:var(--tx-3)] font-medium whitespace-nowrap cursor-pointer select-none hover:text-[color:var(--tx)] transition-colors';

const EMPTY_FORM = {
  vehicle_number: '', name: '', type: 'Truck', fuel_type: 'Diesel', driver: '', status: 'Idle', location: '', current_km: '',
  insurance_company: '', insurance_number: '', insurance_expiry: '', registration_expiry: '',
  vin_number: '', engine_number: '', last_service_date: '', next_service_date: '',
  assigned_driver_id: '', purchase_date: '', purchase_cost: '',
};

export default function VehiclesPage() {
  const { t, lang } = useLanguage();
  const [me, setMe] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  /* Reads ?status= from the URL on first render — this is how the
     dashboard's KPI cards (Running/Idle/Stopped) link straight into a
     pre-filtered list instead of landing on "All". */
  const [status, setStatus] = useState(() => {
    if (typeof window === 'undefined') return 'All';
    return new URLSearchParams(window.location.search).get('status') || 'All';
  });
  const [type, setType] = useState('All');
  const [fuelType, setFuelType] = useState('All');
  const [assignment, setAssignment] = useState('All');
  const [sort, setSort] = useState('latest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { mode: 'add'|'edit', data }
  const [importOpen, setImportOpen] = useState(false);

  const isAdmin = me?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ search: debouncedSearch, status, type, fuelType, assignment, sort, page: String(page), pageSize: String(pageSize) });
    try {
      const res = await fetch('/api/cars?' + q.toString(), { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVehicles(data.vehicles); setTotal(data.total); setError(null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [debouncedSearch, status, type, fuelType, assignment, sort, page, pageSize]);

  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(vehicles);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
    fetch('/api/drivers', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setDrivers(d.drivers || [])).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

  async function saveVehicle(form, mode, id) {
    const url = mode === 'add' ? '/api/cars' : `/api/cars/${id}`;
    const res = await fetch(url, {
      method: mode === 'add' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setModal(null);
    load();
  }

  async function deleteVehicle(id) {
    if (!confirm(t('vehicles.confirmDelete'))) return;
    const res = await fetch(`/api/cars/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) load();
  }

  function exportExcel() { window.location.href = '/api/cars/export'; }

  /* Standardized A4 report PDF — shared engine (lib/reportPdf.js), same
     as the QuotePro and Projects apps. Fetches ALL vehicles through the
     existing list API (pages of 100 — its max) so the PDF carries the
     same complete dataset and columns as the Excel export. */
  async function exportPdf() {
    const all = [];
    for (let p = 1; p <= 200; p++) {
      const res = await fetch('/api/cars?' + new URLSearchParams({ page: String(p), pageSize: '100' }), { credentials: 'same-origin' }).catch(() => null);
      const d = res && res.ok ? await res.json() : null;
      if (!d || !Array.isArray(d.vehicles) || d.vehicles.length === 0) break;
      all.push(...d.vehicles);
      if (all.length >= (d.total || 0)) break;
    }
    const ar = lang === 'ar';
    const { exportReportPdf } = await import('@/lib/reportPdf');
    await exportReportPdf({
      title: ar ? 'تقرير المركبات' : 'Vehicles Report',
      columns: [
        { key: 'vehicle_number', header: ar ? 'رقم المركبة' : 'Vehicle Number' },
        { key: 'name', header: ar ? 'اسم المركبة' : 'Vehicle Name' },
        { key: 'type', header: ar ? 'النوع' : 'Type' },
        { key: 'fuel_type', header: ar ? 'الوقود' : 'Fuel Type' },
        { key: 'driver', header: ar ? 'السائق' : 'Driver' },
        { key: 'status', header: ar ? 'الحالة' : 'Status' },
        { key: 'current_km', header: ar ? 'العداد (كم)' : 'Current KM' },
        { key: 'location', header: ar ? 'الموقع' : 'Location' },
        { key: 'last_update', header: ar ? 'آخر تحديث' : 'Last Update' },
      ],
      rows: all,
      lang,
      fileName: 'vehicles-report.pdf',
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Shell active="/vehicles">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('vehicles.title')}</h2>
          <p className="text-xs text-[color:var(--tx-3)]">{t('vehicles.breadcrumb')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <Button variant="ghost" onClick={() => setImportOpen(true)}>⇪ {t('vehicles.importExcel')}</Button>}
          <Button variant="ghost" onClick={exportExcel}>⤓ {t('vehicles.exportExcel')}</Button>
          <Button variant="ghost" onClick={exportPdf}>⤓ {t('vehicles.exportPdf')}</Button>
          {isAdmin && <Button onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })}>+ {t('vehicles.addVehicle')}</Button>}
        </div>
      </div>

      <div className="glass-card glass-card--pad mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <Input placeholder={t('vehicles.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="col-span-2" />
        <Dropdown value={status} onChange={v => { setPage(1); setStatus(v); }} options={[['All', t('common.all')], ...['Running', 'Idle', 'Stopped', 'Offline'].map(s => [s, trEnum(t, 'status', s)])]} />
        <Dropdown value={fuelType} onChange={v => { setPage(1); setFuelType(v); }} options={[['All', t('common.all')], ...['Diesel', 'Petrol', 'Electric'].map(f => [f, trEnum(t, 'fuel', f)])]} />
        <Dropdown value={assignment} onChange={v => { setPage(1); setAssignment(v); }} options={[['All', t('common.all')], ...['Assigned', 'Unassigned'].map(a => [a, trEnum(t, 'assignment', a)])]} />
      </div>

      {error && <div className="text-[#ef4444] text-sm mb-3">{error}</div>}

      <div className="glass-card overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl">
            <tr>
              <Th>{t('vehicles.colNumber')}</Th>
              <th onClick={() => toggleSort('vehicle_number')} className={SORT_TH}>{t('vehicles.colVehicleNumber')}<SortIndicator column="vehicle_number" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('name')} className={SORT_TH}>{t('vehicles.colName')}<SortIndicator column="name" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('type')} className={SORT_TH}>{t('vehicles.colType')}<SortIndicator column="type" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('fuel_type')} className={SORT_TH}>{t('vehicles.colFuel')}<SortIndicator column="fuel_type" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('driver')} className={SORT_TH}>{t('vehicles.colDriver')}<SortIndicator column="driver" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('status')} className={SORT_TH}>{t('vehicles.colStatus')}<SortIndicator column="status" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('location')} className={SORT_TH}>{t('vehicles.colLocation')}<SortIndicator column="location" sortKey={sortKey} sortDir={sortDir} /></th>
              {isAdmin && <Th className="text-end">{t('vehicles.colActions')}</Th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-8 text-center text-[color:var(--tx-3)]">{t('vehicles.loading')}</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={9}><EmptyState text={t('vehicles.noMatch')} /></td></tr>
            ) : sorted.map((v, i) => (
              <tr key={v.id} className="cursor-pointer hover:bg-[color:var(--pr-soft)] transition-colors"
                onClick={() => { window.location.href = '/vehicles/' + v.id; }}>
                <Td>{(page - 1) * pageSize + i + 1}</Td>
                <Td className="font-medium">{v.vehicle_number}</Td>
                <Td>{v.name || '—'}</Td>
                <Td>{trEnum(t, 'vtype', v.type)}</Td>
                <Td>{trEnum(t, 'fuel', v.fuel_type)}</Td>
                <Td>{v.driver || '—'}</Td>
                <Td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (STATUS_BADGE[v.status] || '')}>{trEnum(t, 'status', v.status)}</span></Td>
                <Td>{v.location || '—'}</Td>
                <td className="px-3 py-2.5 text-sm border-t border-[color:var(--bd)] text-end whitespace-nowrap space-x-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { window.location.href = '/vehicles/' + v.id; }} title={t('vehicles.view')} className="text-[color:var(--tx-3)] hover:text-[color:var(--tx)]">{'\u{1F441}'}</button>
                  {isAdmin && <button onClick={() => setModal({ mode: 'edit', data: v })} title={t('vehicles.edit')} className="text-brand-500 hover:text-brand-600">✎</button>}
                  {isAdmin && <button onClick={() => deleteVehicle(v.id)} title={t('vehicles.delete')} className="text-[#ef4444] hover:text-[#dc2626]">🗑</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-[color:var(--tx-3)] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span>{t('vehicles.showingEntries', { from: vehicles.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + vehicles.length, total })}</span>
          <div className="flex items-center gap-1.5">
            <span>{t('vehicles.rows')}</span>
            <Dropdown className="w-20" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          </div>
        </div>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-lg border border-[color:var(--bd)] disabled:opacity-40 hover:bg-[color:var(--pr-soft)] transition-colors">‹</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-lg border border-[color:var(--bd)] disabled:opacity-40 hover:bg-[color:var(--pr-soft)] transition-colors">›</button>
        </div>
      </div>

      {modal && <VehicleModal modal={modal} drivers={drivers} onClose={() => setModal(null)} onSave={saveVehicle} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load(); }} />}
    </Shell>
  );
}

export function VehicleModal({ modal, drivers, onClose, onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(modal.data);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await onSave(form, modal.mode, modal.data.id); }
    catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Modal title={modal.mode === 'add' ? t('vehicles.addModalTitle') : t('vehicles.editModalTitle')} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="text-[#ef4444] text-sm">{err}</div>}

        <div className="text-xs font-semibold text-[color:var(--tx-3)] uppercase tracking-wide">{t('vehicles.sectionBasic')}</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('fields.vehicleNumber')} required><Input value={form.vehicle_number} onChange={set('vehicle_number')} required /></Field>
          <Field label={t('fields.name')}><Input value={form.name || ''} onChange={set('name')} /></Field>
          <Field label={t('fields.type')}><Input value={form.type || ''} onChange={set('type')} /></Field>
          <Field label={t('fields.fuelType')}><Input value={form.fuel_type || ''} onChange={set('fuel_type')} /></Field>
          <Field label={t('fields.driver')}><Input value={form.driver || ''} onChange={set('driver')} /></Field>
          <Field label={t('fields.status')}>
            <Dropdown value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={['Running', 'Idle', 'Stopped', 'Offline'].map(s => [s, trEnum(t, 'status', s)])} />
          </Field>
          <Field label={t('fields.currentKm')}><Input value={form.current_km ?? ''} onChange={set('current_km')} type="number" /></Field>
          <Field label={t('fields.location')}><Input value={form.location || ''} onChange={set('location')} /></Field>
          <Field label={t('fields.assignedDriver')}>
            <Dropdown value={form.assigned_driver_id || ''} onChange={v => setForm(f => ({ ...f, assigned_driver_id: v }))} placeholder={t('common.none')}
              options={[['', t('common.none')], ...(drivers || []).map(d => [d.id, d.full_name])]} />
          </Field>
        </div>

        <div className="text-xs font-semibold text-[color:var(--tx-3)] uppercase tracking-wide pt-2">{t('vehicles.sectionInsurance')}</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('fields.insuranceCompany')}><Input value={form.insurance_company || ''} onChange={set('insurance_company')} /></Field>
          <Field label={t('fields.insuranceNumber')}><Input value={form.insurance_number || ''} onChange={set('insurance_number')} /></Field>
          <Field label={t('fields.insuranceExpiry')}><Input value={form.insurance_expiry || ''} onChange={set('insurance_expiry')} type="date" /></Field>
          <Field label={t('fields.registrationExpiry')}><Input value={form.registration_expiry || ''} onChange={set('registration_expiry')} type="date" /></Field>
          <Field label={t('fields.vinNumber')}><Input value={form.vin_number || ''} onChange={set('vin_number')} /></Field>
          <Field label={t('fields.engineNumber')}><Input value={form.engine_number || ''} onChange={set('engine_number')} /></Field>
        </div>

        <div className="text-xs font-semibold text-[color:var(--tx-3)] uppercase tracking-wide pt-2">{t('vehicles.sectionService')}</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('fields.lastServiceDate')}><Input value={form.last_service_date || ''} onChange={set('last_service_date')} type="date" /></Field>
          <Field label={t('fields.nextServiceDate')}><Input value={form.next_service_date || ''} onChange={set('next_service_date')} type="date" /></Field>
          <Field label={t('fields.purchaseDate')}><Input value={form.purchase_date || ''} onChange={set('purchase_date')} type="date" /></Field>
          <Field label={t('fields.purchaseCost')}><Input value={form.purchase_cost ?? ''} onChange={set('purchase_cost')} type="number" /></Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('vehicles.cancel')}</Button>
          <Button type="submit" disabled={busy}>{busy ? t('vehicles.saving') : t('vehicles.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }) {
  const { t } = useLanguage();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/import', { method: 'POST', credentials: 'same-origin', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <Modal title={t('vehicles.importTitle')} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-[color:var(--tx-3)]">{t('vehicles.importDesc')}</p>
        {err && <div className="text-[#ef4444] text-sm">{err}</div>}
        {result ? (
          <div className="text-sm space-y-1">
            <div className="text-emerald-500 font-medium">{t('vehicles.importComplete')}</div>
            <div>{t('vehicles.importAdded', { n: result.inserted })}</div>
            <div>{t('vehicles.importSkippedDuplicate', { n: result.skippedDuplicate })}</div>
            <div>{t('vehicles.importSkippedEmpty', { n: result.skippedEmpty })}</div>
            {result.maintenance?.sheetFound && <div>{t('vehicles.importMaintAdded', { n: result.maintenance.inserted, skipped: result.maintenance.skipped })}</div>}
            {result.maintenanceLog?.sheetFound && <div>{t('vehicles.importLogAdded', { n: result.maintenanceLog.inserted, skipped: result.maintenanceLog.skipped })}</div>}
            <Button onClick={onDone} className="mt-3 w-full">{t('vehicles.importDone')}</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <Input type="file" accept=".xlsx" onChange={e => setFile(e.target.files?.[0] || null)} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>{t('vehicles.cancel')}</Button>
              <Button type="submit" disabled={busy || !file}>{busy ? t('vehicles.importing') : t('vehicles.importSubmit')}</Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
