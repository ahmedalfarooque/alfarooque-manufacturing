'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { expiryInfo } from '@/lib/expiry';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { ListPagination } from '@/components/ListPagination';
import { useLanguage, trEnum, trExpiry } from '@/lib/i18n';
import { Button, Input, Textarea, Field, Modal, EmptyState, Th, Td } from '@/components/ui';
import ColumnPicker, { useColumnPrefs, pdfColumns, pdfRows } from '@/components/ColumnPicker';

const STATUS_BADGE = {
  Active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Inactive: 'bg-slate-500/10 text-[color:var(--tx-3)]',
  'On Leave': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Terminated: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const SORT_TH = 'text-start px-3 py-2.5 text-[11px] uppercase tracking-wider text-[color:var(--tx-3)] font-medium whitespace-nowrap cursor-pointer select-none hover:text-[color:var(--tx)] transition-colors';

const EMPTY_FORM = {
  full_name: '', full_name_ar: '', employee_id: '', phone: '', whatsapp: '', email: '', nationality: '',
  date_of_birth: '', blood_group: '', address: '', emergency_contact: '', emergency_phone: '',
  department: '', designation: '', joining_date: '', status: 'Active',
  license_number: '', license_type: '', license_issue_date: '', license_expiry_date: '',
  iqama_number: '', iqama_expiry_date: '', passport_number: '', passport_expiry_date: '', medical_expiry_date: '',
  notes: '', assigned_car_id: '', experience_years: '', driving_category: '',
};

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

  /* Must carry the CURRENTLY FILTERED dataset — same search/status as
     the on-screen list — not an unconditional full-table export. */
  function exportExcel() { window.location.href = '/api/drivers/export?' + new URLSearchParams({ search: debouncedSearch, status }).toString(); }

  /* Standardized A4 report PDF — shared engine (lib/reportPdf.js), same
     as the QuotePro and Projects apps. `sorted` already holds the FULL
     driver list (this page paginates client-side), with the same columns
     as the Excel export. */
  async function exportPdf() {
    const ar = lang === 'ar';
    const { exportReportPdf } = await import('@/lib/reportPdf');
    await exportReportPdf({
      title: ar ? 'تقرير السائقين' : 'Drivers Report',
      columns: pdfColumns(visibleCols),
        rows: pdfRows(visibleCols, sorted),
      lang,
      fileName: 'drivers-report.pdf',
    });
  }

  const badge = info => <span className={'px-2 py-1 rounded-full text-xs font-medium ' + info.className}>{info.dot} {trExpiry(t, info)}</span>;
  const cols = [
    { key: 'photo', label: t('drivers.colPhoto'), noPdf: true, render: d => (d.profile_photo_url
      ? <img src={d.profile_photo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
      : <div className="h-9 w-9 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-medium">{(d.full_name || '?').slice(0, 1).toUpperCase()}</div>) },
    { key: 'full_name', label: t('drivers.colName'), sort: 'full_name', className: 'font-medium', render: d => d.full_name, pdf: d => d.full_name || '' },
    { key: 'employee_id', label: lang === 'ar' ? 'الرقم الوظيفي' : 'Employee ID', hidden: true, render: d => d.employee_id || '—', pdf: d => d.employee_id || '' },
    { key: 'phone', label: t('drivers.colPhone'), sort: 'phone', render: d => d.phone || '—', pdf: d => d.phone || '' },
    { key: 'vehicle', label: t('drivers.colVehicle'), sort: 'cars', render: d => d.cars?.vehicle_number || '—', pdf: d => d.cars?.vehicle_number || '' },
    { key: 'nationality', label: lang === 'ar' ? 'الجنسية' : 'Nationality', hidden: true, render: d => d.nationality || '—', pdf: d => d.nationality || '' },
    { key: 'license_number', label: lang === 'ar' ? 'رقم الرخصة' : 'License Number', hidden: true, render: d => d.license_number || '—', pdf: d => d.license_number || '' },
    { key: 'license_expiry_date', label: t('drivers.colLicenseExpiry'), sort: 'license_expiry_date', render: d => badge(expiryInfo(d.license_expiry_date)), pdf: d => d.license_expiry_date || '' },
    { key: 'iqama_number', label: lang === 'ar' ? 'رقم الإقامة' : 'Iqama Number', hidden: true, render: d => d.iqama_number || '—', pdf: d => d.iqama_number || '' },
    { key: 'iqama_expiry_date', label: t('drivers.colIqamaExpiry'), sort: 'iqama_expiry_date', render: d => badge(expiryInfo(d.iqama_expiry_date)), pdf: d => d.iqama_expiry_date || '' },
    { key: 'status', label: t('drivers.colStatus'), sort: 'status', render: d => <span className={'px-2 py-1 rounded-full text-xs font-medium ' + (STATUS_BADGE[d.status] || '')}>{trEnum(t, 'status', d.status)}</span>, pdf: d => trEnum(t, 'status', d.status) || '' },
    { key: 'actions', label: t('drivers.colActions'), required: true, noPdf: true, stop: true, className: 'text-end whitespace-nowrap', render: d => (
      <div className="flex items-center justify-end gap-2">
        <button onClick={() => { window.location.href = '/drivers/' + d.id; }} title={t('drivers.view')} aria-label={t('drivers.view') + ' ' + d.full_name} className="text-[color:var(--tx-3)] hover:text-[color:var(--tx)]">{'\u{1F441}'}</button>
        {isAdmin && <button onClick={() => setModal({ mode: 'edit', data: { ...d, assigned_car_id: d.assigned_car_id || '' } })} title={t('drivers.edit')} aria-label={t('drivers.edit') + ' ' + d.full_name} className="text-brand-500 hover:text-brand-600">✎</button>}
        {isAdmin && <button onClick={() => deleteDriver(d.id)} title={t('drivers.delete')} aria-label={t('drivers.delete') + ' ' + d.full_name} className="text-[#ef4444] hover:text-[#dc2626]">🗑</button>}
      </div>
    ) },
  ];
  const prefs = useColumnPrefs('drivers', cols);
  const { visibleCols } = prefs;

  return (
    <Shell active="/drivers">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('drivers.title')}</h2>
          <p className="text-xs text-[color:var(--tx-3)]">{t('drivers.breadcrumb')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ColumnPicker columns={cols} prefs={prefs} />
          <Button variant="ghost" onClick={exportExcel}>⤓ {t('drivers.exportExcel')}</Button>
          <Button variant="ghost" onClick={exportPdf}>⤓ {t('drivers.exportPdf')}</Button>
          {isAdmin && <Button onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })}>+ {t('drivers.addDriver')}</Button>}
        </div>
      </div>

      <div className="glass-card glass-card--pad mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Input placeholder={t('drivers.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="col-span-2" />
        <Dropdown value={status} onChange={setStatus} options={[['All', t('common.all')], ...['Active', 'Inactive', 'On Leave', 'Terminated'].map(s => [s, trEnum(t, 'status', s)])]} />
      </div>

      {error && <div className="text-[#ef4444] text-sm mb-3">{error}</div>}

      <div className="glass-card overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl">
            <tr>
              {visibleCols.map(c => c.sort
                ? <th key={c.key} onClick={() => toggleSort(c.sort)} className={SORT_TH + (c.className ? ' ' + c.className : '')}>{c.label}<SortIndicator column={c.sort} sortKey={sortKey} sortDir={sortDir} /></th>
                : <Th key={c.key} className={c.className || ''}>{c.label}</Th>)}
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={visibleCols.length} className="py-8 text-center text-[color:var(--tx-3)]">{t('drivers.loading')}</td></tr>
            ) : drivers.length === 0 ? (
              <tr><td colSpan={visibleCols.length}><EmptyState text={t('drivers.noneYet')} /></td></tr>
            ) : drivers.map((r, i) => (
              <tr key={r.id} className="cursor-pointer hover:bg-[color:var(--pr-soft)] transition-colors" onClick={() => { window.location.href = '/drivers/' + r.id; }}>
                {visibleCols.map(c => <Td key={c.key} className={c.className || ''} onClick={c.stop ? e => e.stopPropagation() : undefined}>{c.render(r, i)}</Td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ListPagination
        page={page} pageSize={pageSize} total={total} count={drivers.length}
        onPage={setPage} onPageSize={v => { setPageSize(v); setPage(1); }}
        showingLabel={({ from, to, total }) => t('drivers.showingEntries', { from, to, total })}
        rowsLabel={t('drivers.rows')}
      />

      {modal && <DriverModal modal={modal} cars={cars} onClose={() => setModal(null)} onSave={saveDriver} />}
    </Shell>
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
    finally { setBusy(false); }
  }

  return (
    <Modal title={modal.mode === 'add' ? t('drivers.addModalTitle') : t('drivers.editModalTitle')} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5 max-h-[75vh] overflow-y-auto -mx-1 px-1">
        {err && <div className="text-[#ef4444] text-sm">{err}</div>}

        <Section title={t('drivers.sectionPersonal')}>
          <Field label={t('fields.fullName')} required><Input value={form.full_name} onChange={set('full_name')} required /></Field>
          <Field label={t('fields.fullNameAr')}><Input value={form.full_name_ar || ''} onChange={set('full_name_ar')} /></Field>
          <Field label={t('fields.employeeId')}><Input value={form.employee_id || ''} onChange={set('employee_id')} /></Field>
          <Field label={t('fields.phone')}><Input value={form.phone || ''} onChange={set('phone')} /></Field>
          <Field label={t('fields.whatsapp')}><Input value={form.whatsapp || ''} onChange={set('whatsapp')} /></Field>
          <Field label={t('fields.email')}><Input type="email" value={form.email || ''} onChange={set('email')} /></Field>
          <Field label={t('fields.nationality')}><Input value={form.nationality || ''} onChange={set('nationality')} /></Field>
          <Field label={t('fields.dateOfBirth')}><Input type="date" value={form.date_of_birth || ''} onChange={set('date_of_birth')} /></Field>
          <Field label={t('fields.bloodGroup')}><Input value={form.blood_group || ''} onChange={set('blood_group')} /></Field>
          <div className="col-span-2"><Field label={t('fields.address')}><Input value={form.address || ''} onChange={set('address')} /></Field></div>
          <Field label={t('fields.emergencyContact')}><Input value={form.emergency_contact || ''} onChange={set('emergency_contact')} /></Field>
          <Field label={t('fields.emergencyPhone')}><Input value={form.emergency_phone || ''} onChange={set('emergency_phone')} /></Field>
        </Section>

        <Section title={t('drivers.sectionEmployment')}>
          <Field label={t('fields.department')}><Input value={form.department || ''} onChange={set('department')} /></Field>
          <Field label={t('fields.designation')}><Input value={form.designation || ''} onChange={set('designation')} /></Field>
          <Field label={t('fields.joiningDate')}><Input type="date" value={form.joining_date || ''} onChange={set('joining_date')} /></Field>
          <Field label={t('fields.status')}>
            <Dropdown value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={['Active', 'Inactive', 'On Leave', 'Terminated'].map(s => [s, trEnum(t, 'status', s)])} />
          </Field>
          <Field label={t('fields.assignedVehicle')}>
            <Dropdown value={form.assigned_car_id || ''} onChange={v => setForm(f => ({ ...f, assigned_car_id: v }))} placeholder={t('common.none')}
              options={[['', t('common.none')], ...cars.map(c => [c.id, c.vehicle_number + ' — ' + c.name])]} />
          </Field>
          <Field label={t('fields.experienceYears')}><Input type="number" value={form.experience_years ?? ''} onChange={set('experience_years')} /></Field>
          <Field label={t('fields.drivingCategory')}><Input value={form.driving_category || ''} onChange={set('driving_category')} /></Field>
        </Section>

        <Section title={t('drivers.sectionLicense')}>
          <Field label={t('fields.licenseNumber')}><Input value={form.license_number || ''} onChange={set('license_number')} /></Field>
          <Field label={t('fields.licenseType')}><Input value={form.license_type || ''} onChange={set('license_type')} /></Field>
          <Field label={t('fields.issueDate')}><Input type="date" value={form.license_issue_date || ''} onChange={set('license_issue_date')} /></Field>
          <Field label={t('fields.expiryDate')}><Input type="date" value={form.license_expiry_date || ''} onChange={set('license_expiry_date')} /></Field>
        </Section>

        <Section title={t('drivers.sectionIqama')}>
          <Field label={t('fields.iqamaNumber')}><Input value={form.iqama_number || ''} onChange={set('iqama_number')} /></Field>
          <Field label={t('fields.iqamaExpiry')}><Input type="date" value={form.iqama_expiry_date || ''} onChange={set('iqama_expiry_date')} /></Field>
          <Field label={t('fields.passportNumber')}><Input value={form.passport_number || ''} onChange={set('passport_number')} /></Field>
          <Field label={t('fields.passportExpiry')}><Input type="date" value={form.passport_expiry_date || ''} onChange={set('passport_expiry_date')} /></Field>
          <Field label={t('fields.medicalExpiry')}><Input type="date" value={form.medical_expiry_date || ''} onChange={set('medical_expiry_date')} /></Field>
        </Section>

        <Field label={t('drivers.notes')}>
          <Textarea value={form.notes || ''} onChange={set('notes')} rows={2} />
        </Field>

        <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-[color:var(--nav-bg)] backdrop-blur-xl pb-1">
          <Button type="button" variant="ghost" onClick={onClose}>{t('drivers.cancel')}</Button>
          <Button type="submit" disabled={busy}>{busy ? t('drivers.saving') : t('drivers.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function Section({ title, children }) {
  return (
    <fieldset className="border border-[color:var(--bd)] rounded-xl p-4">
      <legend className="text-xs font-semibold text-[color:var(--tx-3)] px-1">{title}</legend>
      <div className="grid grid-cols-2 gap-3 mt-1">{children}</div>
    </fieldset>
  );
}
