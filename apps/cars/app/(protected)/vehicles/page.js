'use client';

import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { useLanguage, trEnum } from '@/lib/i18n';
import {
  GlassPage, GlassButton, GlassDropdown, GlassSearch, GlassStatusChip,
  GlassThead, GlassTr, GlassTd, GlassField, GlassInput, GlassModal, GlassEmptyState, GlassLoader,
} from '@/components/glass';

const STATUS_TONE = { Running: 'emerald', Idle: 'amber', Stopped: 'red', Offline: 'slate' };

const EMPTY_FORM = {
  vehicle_number: '', name: '', type: 'Truck', fuel_type: 'Diesel', driver: '', status: 'Idle', location: '', current_km: '',
  insurance_company: '', insurance_number: '', insurance_expiry: '', registration_expiry: '',
  vin_number: '', engine_number: '', last_service_date: '', next_service_date: '',
  assigned_driver_id: '', purchase_date: '', purchase_cost: '',
};

const TH = 'text-start px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-[var(--tx-4)] font-semibold whitespace-nowrap';
const THsort = TH + ' cursor-pointer select-none hover:text-[var(--pr-2)] transition-colors';

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
  const SortTh = ({ col, label }) => (
    <th onClick={() => toggleSort(col)} className={THsort}>{label}<SortIndicator column={col} sortKey={sortKey} sortDir={sortDir} /></th>
  );

  return (
    <Shell active="/vehicles">
      <GlassPage
        title={t('vehicles.title')}
        subtitle={t('vehicles.breadcrumb')}
        toolbar={
          <>
            {isAdmin && <GlassButton variant="ghost" onClick={() => setImportOpen(true)}>⇪ {t('vehicles.importExcel')}</GlassButton>}
            <GlassButton variant="ghost" onClick={exportExcel}>⤓ {t('vehicles.exportExcel')}</GlassButton>
            <GlassButton variant="ghost" onClick={exportPdf}>⤓ {t('vehicles.exportPdf')}</GlassButton>
            {isAdmin && <GlassButton onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })}>+ {t('vehicles.addVehicle')}</GlassButton>}
          </>
        }
      >
        {/* Filters */}
        <div className="glass-card !rounded-[22px] p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          <GlassSearch className="col-span-2" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('vehicles.searchPlaceholder')} />
          <GlassDropdown value={status} onChange={v => { setPage(1); setStatus(v); }} options={[['All', t('common.all')], ...['Running', 'Idle', 'Stopped', 'Offline'].map(s => [s, trEnum(t, 'status', s)])]} />
          <GlassDropdown value={fuelType} onChange={v => { setPage(1); setFuelType(v); }} options={[['All', t('common.all')], ...['Diesel', 'Petrol', 'Electric'].map(f => [f, trEnum(t, 'fuel', f)])]} />
          <GlassDropdown value={assignment} onChange={v => { setPage(1); setAssignment(v); }} options={[['All', t('common.all')], ...['Assigned', 'Unassigned'].map(a => [a, trEnum(t, 'assignment', a)])]} />
        </div>

        {error && <div className="text-[#F87171] text-sm">{error}</div>}

        {/* Table */}
        <div className="glass-card !rounded-[22px] overflow-auto max-h-[70vh]">
          <table className="w-full min-w-[900px]">
            <GlassThead>
              <tr>
                <th className={TH}>{t('vehicles.colNumber')}</th>
                <SortTh col="vehicle_number" label={t('vehicles.colVehicleNumber')} />
                <SortTh col="name" label={t('vehicles.colName')} />
                <SortTh col="type" label={t('vehicles.colType')} />
                <SortTh col="fuel_type" label={t('vehicles.colFuel')} />
                <SortTh col="driver" label={t('vehicles.colDriver')} />
                <SortTh col="status" label={t('vehicles.colStatus')} />
                <SortTh col="location" label={t('vehicles.colLocation')} />
                {isAdmin && <th className={TH + ' text-end'}>{t('vehicles.colActions')}</th>}
              </tr>
            </GlassThead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9}><GlassLoader label={t('vehicles.loading')} /></td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={9}><GlassEmptyState text={t('vehicles.noMatch')} /></td></tr>
              ) : sorted.map((v, i) => (
                <GlassTr key={v.id} onClick={() => { window.location.href = '/vehicles/' + v.id; }}>
                  <GlassTd className="text-[var(--tx-4)]">{(page - 1) * pageSize + i + 1}</GlassTd>
                  <GlassTd className="font-semibold !text-[var(--tx)]">{v.vehicle_number}</GlassTd>
                  <GlassTd>{v.name || '—'}</GlassTd>
                  <GlassTd>{trEnum(t, 'vtype', v.type)}</GlassTd>
                  <GlassTd>{trEnum(t, 'fuel', v.fuel_type)}</GlassTd>
                  <GlassTd>{v.driver || '—'}</GlassTd>
                  <GlassTd><GlassStatusChip label={trEnum(t, 'status', v.status)} tone={STATUS_TONE[v.status] || 'slate'} /></GlassTd>
                  <GlassTd>{v.location || '—'}</GlassTd>
                  {isAdmin && (
                    <GlassTd className="text-end whitespace-nowrap" >
                      <span onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1.5">
                        <IconBtn title={t('vehicles.view')} onClick={() => { window.location.href = '/vehicles/' + v.id; }}>{'\u{1F441}'}</IconBtn>
                        <IconBtn title={t('vehicles.edit')} tone="brand" onClick={() => setModal({ mode: 'edit', data: v })}>✎</IconBtn>
                        <IconBtn title={t('vehicles.delete')} tone="red" onClick={() => deleteVehicle(v.id)}>🗑</IconBtn>
                      </span>
                    </GlassTd>
                  )}
                </GlassTr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="flex items-center justify-between text-sm text-[var(--tx-4)] flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span>{t('vehicles.showingEntries', { from: vehicles.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + vehicles.length, total })}</span>
            <div className="flex items-center gap-1.5">
              <span>{t('vehicles.rows')}</span>
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

      {modal && <VehicleModal modal={modal} drivers={drivers} onClose={() => setModal(null)} onSave={saveVehicle} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load(); }} />}
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
  const SecTitle = ({ children }) => <div className="text-[11px] font-semibold text-[var(--tx-4)] uppercase tracking-[0.1em] pt-1">{children}</div>;

  return (
    <GlassModal wide title={modal.mode === 'add' ? t('vehicles.addModalTitle') : t('vehicles.editModalTitle')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="text-[#F87171] text-sm">{err}</div>}

        <SecTitle>{t('vehicles.sectionBasic')}</SecTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <GlassField label={t('fields.vehicleNumber')} required><GlassInput value={form.vehicle_number} onChange={set('vehicle_number')} required /></GlassField>
          <GlassField label={t('fields.name')}><GlassInput value={form.name || ''} onChange={set('name')} /></GlassField>
          <GlassField label={t('fields.type')}><GlassInput value={form.type || ''} onChange={set('type')} /></GlassField>
          <GlassField label={t('fields.fuelType')}><GlassInput value={form.fuel_type || ''} onChange={set('fuel_type')} /></GlassField>
          <GlassField label={t('fields.driver')}><GlassInput value={form.driver || ''} onChange={set('driver')} /></GlassField>
          <GlassField label={t('fields.status')}>
            <GlassDropdown value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={['Running', 'Idle', 'Stopped', 'Offline'].map(s => [s, trEnum(t, 'status', s)])} />
          </GlassField>
          <GlassField label={t('fields.currentKm')}><GlassInput value={form.current_km ?? ''} onChange={set('current_km')} type="number" /></GlassField>
          <GlassField label={t('fields.location')}><GlassInput value={form.location || ''} onChange={set('location')} /></GlassField>
          <GlassField label={t('fields.assignedDriver')}>
            <GlassDropdown value={form.assigned_driver_id || ''} onChange={v => setForm(f => ({ ...f, assigned_driver_id: v }))} placeholder={t('common.none')}
              options={[['', t('common.none')], ...(drivers || []).map(d => [d.id, d.full_name])]} />
          </GlassField>
        </div>

        <SecTitle>{t('vehicles.sectionInsurance')}</SecTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <GlassField label={t('fields.insuranceCompany')}><GlassInput value={form.insurance_company || ''} onChange={set('insurance_company')} /></GlassField>
          <GlassField label={t('fields.insuranceNumber')}><GlassInput value={form.insurance_number || ''} onChange={set('insurance_number')} /></GlassField>
          <GlassField label={t('fields.insuranceExpiry')}><GlassInput value={form.insurance_expiry || ''} onChange={set('insurance_expiry')} type="date" /></GlassField>
          <GlassField label={t('fields.registrationExpiry')}><GlassInput value={form.registration_expiry || ''} onChange={set('registration_expiry')} type="date" /></GlassField>
          <GlassField label={t('fields.vinNumber')}><GlassInput value={form.vin_number || ''} onChange={set('vin_number')} /></GlassField>
          <GlassField label={t('fields.engineNumber')}><GlassInput value={form.engine_number || ''} onChange={set('engine_number')} /></GlassField>
        </div>

        <SecTitle>{t('vehicles.sectionService')}</SecTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <GlassField label={t('fields.lastServiceDate')}><GlassInput value={form.last_service_date || ''} onChange={set('last_service_date')} type="date" /></GlassField>
          <GlassField label={t('fields.nextServiceDate')}><GlassInput value={form.next_service_date || ''} onChange={set('next_service_date')} type="date" /></GlassField>
          <GlassField label={t('fields.purchaseDate')}><GlassInput value={form.purchase_date || ''} onChange={set('purchase_date')} type="date" /></GlassField>
          <GlassField label={t('fields.purchaseCost')}><GlassInput value={form.purchase_cost ?? ''} onChange={set('purchase_cost')} type="number" /></GlassField>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <GlassButton type="button" variant="ghost" onClick={onClose}>{t('vehicles.cancel')}</GlassButton>
          <GlassButton type="submit" disabled={busy}>{busy ? t('vehicles.saving') : t('vehicles.save')}</GlassButton>
        </div>
      </form>
    </GlassModal>
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
    <GlassModal title={t('vehicles.importTitle')} onClose={onClose}>
      <p className="text-xs text-[var(--tx-4)] mb-3">{t('vehicles.importDesc')}</p>
      {err && <div className="text-[#F87171] text-sm mb-3">{err}</div>}
      {result ? (
        <div className="text-sm space-y-1 text-[var(--tx-2)]">
          <div className="text-[#34D399] font-medium">{t('vehicles.importComplete')}</div>
          <div>{t('vehicles.importAdded', { n: result.inserted })}</div>
          <div>{t('vehicles.importSkippedDuplicate', { n: result.skippedDuplicate })}</div>
          <div>{t('vehicles.importSkippedEmpty', { n: result.skippedEmpty })}</div>
          {result.maintenance?.sheetFound && <div>{t('vehicles.importMaintAdded', { n: result.maintenance.inserted, skipped: result.maintenance.skipped })}</div>}
          {result.maintenanceLog?.sheetFound && <div>{t('vehicles.importLogAdded', { n: result.maintenanceLog.inserted, skipped: result.maintenanceLog.skipped })}</div>}
          <GlassButton onClick={onDone} className="mt-3 w-full">{t('vehicles.importDone')}</GlassButton>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <input type="file" accept=".xlsx" onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-[var(--tx-2)] file:mr-3 file:rounded-full file:border-0 file:bg-[rgba(37,212,255,0.15)] file:px-4 file:py-2 file:text-[var(--pr-2)] file:font-semibold" />
          <div className="flex justify-end gap-2">
            <GlassButton type="button" variant="ghost" onClick={onClose}>{t('vehicles.cancel')}</GlassButton>
            <GlassButton type="submit" disabled={busy || !file}>{busy ? t('vehicles.importing') : t('vehicles.importSubmit')}</GlassButton>
          </div>
        </form>
      )}
    </GlassModal>
  );
}
