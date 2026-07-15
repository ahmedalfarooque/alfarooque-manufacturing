'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { useLiveData } from '@/lib/useLiveData';
import { expiryInfo } from '@/lib/expiry';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { useLanguage, trEnum, trExpiry } from '@/lib/i18n';
import {
  GlassPage, GlassButton, GlassDropdown, GlassSearch, GlassStatusChip, GlassAvatar,
  GlassThead, GlassTr, GlassTd, GlassField, GlassInput, GlassTextarea, GlassModal, GlassEmptyState, GlassLoader,
} from '@/components/glass';

const STATUS_TONE = { Active: 'emerald', Inactive: 'slate', 'On Leave': 'amber', Terminated: 'red' };

const EMPTY_FORM = {
  full_name: '', full_name_ar: '', employee_id: '', phone: '', whatsapp: '', email: '', nationality: '',
  date_of_birth: '', blood_group: '', address: '', emergency_contact: '', emergency_phone: '',
  department: '', designation: '', joining_date: '', status: 'Active',
  license_number: '', license_type: '', license_issue_date: '', license_expiry_date: '',
  iqama_number: '', iqama_expiry_date: '', passport_number: '', passport_expiry_date: '', medical_expiry_date: '',
  notes: '', assigned_car_id: '', experience_years: '', driving_category: '',
};

const TH = 'text-start px-4 py-3 text-[11px] uppercase tracking-[0.08em] text-[var(--tx-4)] font-semibold whitespace-nowrap';
const THsort = TH + ' cursor-pointer select-none hover:text-[var(--pr-2)] transition-colors';

export default function DriversPage() {
  const { t, lang } = useLanguage();
  const [me, setMe] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState('All');
  const [modal, setModal] = useState(null);
  const [cars, setCars] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const isAdmin = me?.role === 'admin';
  const url = '/api/drivers?' + new URLSearchParams({ search: debouncedSearch, status }).toString();
  const { data, error, refresh } = useLiveData(url, 15000);
  const allDrivers = data?.drivers || [];
  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(allDrivers, {
    cars: d => d.cars?.vehicle_number, license_expiry_date: d => d.license_expiry_date || '',
    iqama_expiry_date: d => d.iqama_expiry_date || '',
  });
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const drivers = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [debouncedSearch, status]);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
    fetch('/api/cars?pageSize=100', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setCars(d.vehicles || [])).catch(() => {});
  }, []);

  async function saveDriver(form, mode, id) {
    const reqUrl = mode === 'add' ? '/api/drivers' : `/api/drivers/${id}`;
    const res = await fetch(reqUrl, {
      method: mode === 'add' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(form),
    });
    const respData = await res.json();
    if (!res.ok) throw new Error(respData.error);
    setModal(null);
    refresh();
  }

  async function deleteDriver(id) {
    if (!confirm(t('drivers.confirmDelete'))) return;
    const res = await fetch(`/api/drivers/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) refresh();
  }

  function exportExcel() { window.location.href = '/api/drivers/export'; }

  /* Standardized A4 report PDF — shared engine (lib/reportPdf.js), same
     as the QuotePro and Projects apps. `sorted` already holds the FULL
     driver list (this page paginates client-side), with the same columns
     as the Excel export. */
  async function exportPdf() {
    const ar = lang === 'ar';
    const { exportReportPdf } = await import('@/lib/reportPdf');
    await exportReportPdf({
      title: ar ? 'تقرير السائقين' : 'Drivers Report',
      columns: [
        { key: 'full_name', header: ar ? 'الاسم الكامل' : 'Full Name' },
        { key: 'employee_id', header: ar ? 'الرقم الوظيفي' : 'Employee ID' },
        { key: 'phone', header: ar ? 'الهاتف' : 'Phone' },
        { key: 'vehicle', header: ar ? 'المركبة' : 'Vehicle' },
        { key: 'nationality', header: ar ? 'الجنسية' : 'Nationality' },
        { key: 'license_number', header: ar ? 'رقم الرخصة' : 'License Number' },
        { key: 'license_expiry_date', header: ar ? 'انتهاء الرخصة' : 'License Expiry' },
        { key: 'iqama_number', header: ar ? 'رقم الإقامة' : 'Iqama Number' },
        { key: 'iqama_expiry_date', header: ar ? 'انتهاء الإقامة' : 'Iqama Expiry' },
        { key: 'status', header: ar ? 'الحالة' : 'Status' },
      ],
      rows: sorted.map(d => ({ ...d, vehicle: d.cars?.vehicle_number || '' })),
      lang,
      fileName: 'drivers-report.pdf',
    });
  }

  const SortTh = ({ col, label }) => (
    <th onClick={() => toggleSort(col)} className={THsort}>{label}<SortIndicator column={col} sortKey={sortKey} sortDir={sortDir} /></th>
  );
  const ExpiryChip = ({ info }) => (
    <span className={'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ' + info.className}>{info.dot} {trExpiry(t, info)}</span>
  );

  return (
    <Shell active="/drivers">
      <GlassPage
        title={t('drivers.title')}
        subtitle={t('drivers.breadcrumb')}
        toolbar={
          <>
            <GlassButton variant="ghost" onClick={exportExcel}>⤓ {t('drivers.exportExcel')}</GlassButton>
            <GlassButton variant="ghost" onClick={exportPdf}>⤓ {t('drivers.exportPdf')}</GlassButton>
            {isAdmin && <GlassButton onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })}>+ {t('drivers.addDriver')}</GlassButton>}
          </>
        }
      >
        <div className="glass-card !rounded-[22px] p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <GlassSearch className="col-span-2" value={search} onChange={e => setSearch(e.target.value)} placeholder={t('drivers.searchPlaceholder')} />
          <GlassDropdown value={status} onChange={setStatus} options={[['All', t('common.all')], ...['Active', 'Inactive', 'On Leave', 'Terminated'].map(s => [s, trEnum(t, 'status', s)])]} />
        </div>

        {error && <div className="text-[#F87171] text-sm">{error}</div>}

        <div className="glass-card !rounded-[22px] overflow-auto max-h-[70vh]">
          <table className="w-full min-w-[900px]">
            <GlassThead>
              <tr>
                <th className={TH}>{t('drivers.colPhoto')}</th>
                <SortTh col="full_name" label={t('drivers.colName')} />
                <SortTh col="phone" label={t('drivers.colPhone')} />
                <SortTh col="cars" label={t('drivers.colVehicle')} />
                <SortTh col="license_expiry_date" label={t('drivers.colLicenseExpiry')} />
                <SortTh col="iqama_expiry_date" label={t('drivers.colIqamaExpiry')} />
                <SortTh col="status" label={t('drivers.colStatus')} />
                <th className={TH + ' text-end'}>{t('drivers.colActions')}</th>
              </tr>
            </GlassThead>
            <tbody>
              {!data ? (
                <tr><td colSpan={8}><GlassLoader label={t('drivers.loading')} /></td></tr>
              ) : drivers.length === 0 ? (
                <tr><td colSpan={8}><GlassEmptyState text={t('drivers.noneYet')} /></td></tr>
              ) : drivers.map(d => {
                const lic = expiryInfo(d.license_expiry_date);
                const iqama = expiryInfo(d.iqama_expiry_date);
                return (
                  <GlassTr key={d.id} onClick={() => { window.location.href = '/drivers/' + d.id; }}>
                    <GlassTd><GlassAvatar name={d.full_name} src={d.profile_photo_url} size={36} /></GlassTd>
                    <GlassTd className="font-semibold !text-[var(--tx)]">{d.full_name}</GlassTd>
                    <GlassTd>{d.phone || '—'}</GlassTd>
                    <GlassTd>{d.cars?.vehicle_number || '—'}</GlassTd>
                    <GlassTd><ExpiryChip info={lic} /></GlassTd>
                    <GlassTd><ExpiryChip info={iqama} /></GlassTd>
                    <GlassTd><GlassStatusChip label={trEnum(t, 'status', d.status)} tone={STATUS_TONE[d.status] || 'slate'} /></GlassTd>
                    <GlassTd className="text-end whitespace-nowrap">
                      <span onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1.5">
                        <IconBtn title={t('drivers.view')} onClick={() => { window.location.href = '/drivers/' + d.id; }}>{'\u{1F441}'}</IconBtn>
                        {isAdmin && <IconBtn title={t('drivers.edit')} tone="brand" onClick={() => setModal({ mode: 'edit', data: { ...d, assigned_car_id: d.assigned_car_id || '' } })}>✎</IconBtn>}
                        {isAdmin && <IconBtn title={t('drivers.delete')} tone="red" onClick={() => deleteDriver(d.id)}>🗑</IconBtn>}
                      </span>
                    </GlassTd>
                  </GlassTr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-[var(--tx-4)] flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span>{t('drivers.showingEntries', { from: drivers.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + drivers.length, total })}</span>
            <div className="flex items-center gap-1.5">
              <span>{t('drivers.rows')}</span>
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

      {modal && <DriverModal modal={modal} cars={cars} onClose={() => setModal(null)} onSave={saveDriver} />}
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

export function DriverModal({ modal, cars, onClose, onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ ...EMPTY_FORM, ...modal.data });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await onSave(form, modal.mode, modal.data.id); }
    catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <GlassModal wide title={modal.mode === 'add' ? t('drivers.addModalTitle') : t('drivers.editModalTitle')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5 max-h-[75vh] overflow-y-auto pe-1">
        {err && <div className="text-[#F87171] text-sm">{err}</div>}

        <Section title={t('drivers.sectionPersonal')}>
          <GlassField label={t('fields.fullName')} required><GlassInput value={form.full_name} onChange={set('full_name')} required /></GlassField>
          <GlassField label={t('fields.fullNameAr')}><GlassInput value={form.full_name_ar || ''} onChange={set('full_name_ar')} /></GlassField>
          <GlassField label={t('fields.employeeId')}><GlassInput value={form.employee_id || ''} onChange={set('employee_id')} /></GlassField>
          <GlassField label={t('fields.phone')}><GlassInput value={form.phone || ''} onChange={set('phone')} /></GlassField>
          <GlassField label={t('fields.whatsapp')}><GlassInput value={form.whatsapp || ''} onChange={set('whatsapp')} /></GlassField>
          <GlassField label={t('fields.email')}><GlassInput type="email" value={form.email || ''} onChange={set('email')} /></GlassField>
          <GlassField label={t('fields.nationality')}><GlassInput value={form.nationality || ''} onChange={set('nationality')} /></GlassField>
          <GlassField label={t('fields.dateOfBirth')}><GlassInput type="date" value={form.date_of_birth || ''} onChange={set('date_of_birth')} /></GlassField>
          <GlassField label={t('fields.bloodGroup')}><GlassInput value={form.blood_group || ''} onChange={set('blood_group')} /></GlassField>
          <GlassField className="col-span-2" label={t('fields.address')}><GlassInput value={form.address || ''} onChange={set('address')} /></GlassField>
          <GlassField label={t('fields.emergencyContact')}><GlassInput value={form.emergency_contact || ''} onChange={set('emergency_contact')} /></GlassField>
          <GlassField label={t('fields.emergencyPhone')}><GlassInput value={form.emergency_phone || ''} onChange={set('emergency_phone')} /></GlassField>
        </Section>

        <Section title={t('drivers.sectionEmployment')}>
          <GlassField label={t('fields.department')}><GlassInput value={form.department || ''} onChange={set('department')} /></GlassField>
          <GlassField label={t('fields.designation')}><GlassInput value={form.designation || ''} onChange={set('designation')} /></GlassField>
          <GlassField label={t('fields.joiningDate')}><GlassInput type="date" value={form.joining_date || ''} onChange={set('joining_date')} /></GlassField>
          <GlassField label={t('fields.status')}>
            <GlassDropdown value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={['Active', 'Inactive', 'On Leave', 'Terminated'].map(s => [s, trEnum(t, 'status', s)])} />
          </GlassField>
          <GlassField label={t('fields.assignedVehicle')}>
            <GlassDropdown value={form.assigned_car_id || ''} onChange={v => setForm(f => ({ ...f, assigned_car_id: v }))} placeholder={t('common.none')}
              options={[['', t('common.none')], ...cars.map(c => [c.id, c.vehicle_number + ' — ' + c.name])]} />
          </GlassField>
          <GlassField label={t('fields.experienceYears')}><GlassInput type="number" value={form.experience_years ?? ''} onChange={set('experience_years')} /></GlassField>
          <GlassField label={t('fields.drivingCategory')}><GlassInput value={form.driving_category || ''} onChange={set('driving_category')} /></GlassField>
        </Section>

        <Section title={t('drivers.sectionLicense')}>
          <GlassField label={t('fields.licenseNumber')}><GlassInput value={form.license_number || ''} onChange={set('license_number')} /></GlassField>
          <GlassField label={t('fields.licenseType')}><GlassInput value={form.license_type || ''} onChange={set('license_type')} /></GlassField>
          <GlassField label={t('fields.issueDate')}><GlassInput type="date" value={form.license_issue_date || ''} onChange={set('license_issue_date')} /></GlassField>
          <GlassField label={t('fields.expiryDate')}><GlassInput type="date" value={form.license_expiry_date || ''} onChange={set('license_expiry_date')} /></GlassField>
        </Section>

        <Section title={t('drivers.sectionIqama')}>
          <GlassField label={t('fields.iqamaNumber')}><GlassInput value={form.iqama_number || ''} onChange={set('iqama_number')} /></GlassField>
          <GlassField label={t('fields.iqamaExpiry')}><GlassInput type="date" value={form.iqama_expiry_date || ''} onChange={set('iqama_expiry_date')} /></GlassField>
          <GlassField label={t('fields.passportNumber')}><GlassInput value={form.passport_number || ''} onChange={set('passport_number')} /></GlassField>
          <GlassField label={t('fields.passportExpiry')}><GlassInput type="date" value={form.passport_expiry_date || ''} onChange={set('passport_expiry_date')} /></GlassField>
          <GlassField label={t('fields.medicalExpiry')}><GlassInput type="date" value={form.medical_expiry_date || ''} onChange={set('medical_expiry_date')} /></GlassField>
        </Section>

        <GlassField label={t('drivers.notes')}><GlassTextarea value={form.notes || ''} onChange={set('notes')} rows={2} /></GlassField>

        <div className="flex justify-end gap-2 pt-1">
          <GlassButton type="button" variant="ghost" onClick={onClose}>{t('drivers.cancel')}</GlassButton>
          <GlassButton type="submit" disabled={busy}>{busy ? t('drivers.saving') : t('drivers.save')}</GlassButton>
        </div>
      </form>
    </GlassModal>
  );
}

function Section({ title, children }) {
  return (
    <fieldset className="border border-[var(--bd)] rounded-2xl p-4">
      <legend className="text-[11px] font-semibold text-[var(--tx-4)] uppercase tracking-[0.1em] px-1">{title}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">{children}</div>
    </fieldset>
  );
}
