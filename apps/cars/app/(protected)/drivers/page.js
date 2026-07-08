'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { expiryInfo } from '@/lib/expiry';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { useLanguage } from '@/lib/i18n';

const STATUS_BADGE = {
  Active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Inactive: 'bg-slate-500/10 text-slate-500',
  'On Leave': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Terminated: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const EMPTY_FORM = {
  full_name: '', full_name_ar: '', employee_id: '', phone: '', whatsapp: '', email: '', nationality: '',
  date_of_birth: '', blood_group: '', address: '', emergency_contact: '', emergency_phone: '',
  department: '', designation: '', joining_date: '', status: 'Active',
  license_number: '', license_type: '', license_issue_date: '', license_expiry_date: '',
  iqama_number: '', iqama_expiry_date: '', passport_number: '', passport_expiry_date: '', medical_expiry_date: '',
  notes: '', assigned_car_id: '', experience_years: '', driving_category: '',
};

export default function DriversPage() {
  const { t } = useLanguage();
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
    if (!confirm('Delete this driver? This cannot be undone.')) return;
    const res = await fetch(`/api/drivers/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) refresh();
  }

  function exportExcel() { window.location.href = '/api/drivers/export'; }

  async function exportPdf() {
    const [{ default: jsPDF }] = await Promise.all([import('jspdf')]);
    await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text('AL FAROOQUE — Drivers', 14, 14);
    doc.autoTable({
      startY: 20,
      head: [['#', 'Name', 'Phone', 'Vehicle', 'License Expiry', 'Iqama Expiry', 'Status']],
      body: sorted.map((d, i) => [i + 1, d.full_name, d.phone || '—', d.cars?.vehicle_number || '—', d.license_expiry_date || '—', d.iqama_expiry_date || '—', d.status]),
    });
    doc.save('drivers.pdf');
  }

  return (
    <Shell active="/drivers">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('drivers.title')}</h2>
          <p className="text-xs text-slate-500">{t('drivers.breadcrumb')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} className="text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white">⤓ {t('drivers.exportExcel')}</button>
          <button onClick={exportPdf} className="text-sm px-3 py-2 rounded-lg bg-red-600 text-white">⤓ {t('drivers.exportPdf')}</button>
          {isAdmin && <button onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })} className="text-sm px-3 py-2 rounded-lg bg-brand-500 text-white">+ {t('drivers.addDriver')}</button>}
        </div>
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input placeholder={t('drivers.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
          className="col-span-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
        <Dropdown value={status} onChange={setStatus} options={['All', 'Active', 'Inactive', 'On Leave', 'Terminated']} />
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th className="py-3 px-4">{t('drivers.colPhoto')}</th>
              <th onClick={() => toggleSort('full_name')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('drivers.colName')}<SortIndicator column="full_name" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('phone')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('drivers.colPhone')}<SortIndicator column="phone" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('cars')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('drivers.colVehicle')}<SortIndicator column="cars" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('license_expiry_date')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('drivers.colLicenseExpiry')}<SortIndicator column="license_expiry_date" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('iqama_expiry_date')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('drivers.colIqamaExpiry')}<SortIndicator column="iqama_expiry_date" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('status')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('drivers.colStatus')}<SortIndicator column="status" sortKey={sortKey} sortDir={sortDir} /></th>
              <th className="text-right px-4">{t('drivers.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">{t('drivers.loading')}</td></tr>
            ) : drivers.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">{t('drivers.noneYet')}</td></tr>
            ) : drivers.map(d => {
              const lic = expiryInfo(d.license_expiry_date);
              const iqama = expiryInfo(d.iqama_expiry_date);
              return (
                <tr key={d.id} className="border-b border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  onClick={() => { window.location.href = '/drivers/' + d.id; }}>
                  <td className="py-2 px-4">
                    {d.profile_photo_url ? (
                      <img src={d.profile_photo_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-medium">{d.full_name.slice(0, 1).toUpperCase()}</div>
                    )}
                  </td>
                  <td className="font-medium">{d.full_name}</td>
                  <td>{d.phone || '—'}</td>
                  <td>{d.cars?.vehicle_number || '—'}</td>
                  <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + lic.className}>{lic.dot} {lic.label}</span></td>
                  <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + iqama.className}>{iqama.dot} {iqama.label}</span></td>
                  <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (STATUS_BADGE[d.status] || '')}>{d.status}</span></td>
                  <td className="text-right px-4 space-x-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { window.location.href = '/drivers/' + d.id; }} title={t('drivers.view')} className="text-slate-400">{'\u{1F441}'}</button>
                    {isAdmin && <button onClick={() => setModal({ mode: 'edit', data: { ...d, assigned_car_id: d.assigned_car_id || '' } })} title={t('drivers.edit')} className="text-brand-500">✎</button>}
                    {isAdmin && <button onClick={() => deleteDriver(d.id)} title={t('drivers.delete')} className="text-red-500">🗑</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-slate-500 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span>{t('drivers.showingEntries', { from: drivers.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + drivers.length, total })}</span>
          <div className="flex items-center gap-1.5">
            <span>{t('drivers.rows')}</span>
            <Dropdown className="w-20" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          </div>
        </div>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">‹</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">›</button>
        </div>
      </div>

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
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-3xl rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-lg">{modal.mode === 'add' ? t('drivers.addModalTitle') : t('drivers.editModalTitle')}</h3>
        {err && <div className="text-red-500 text-sm">{err}</div>}

        <Section title={t('drivers.sectionPersonal')}>
          <Field label="Full Name" value={form.full_name} onChange={set('full_name')} required />
          <Field label="Full Name (Arabic)" value={form.full_name_ar || ''} onChange={set('full_name_ar')} />
          <Field label="Employee ID" value={form.employee_id || ''} onChange={set('employee_id')} />
          <Field label="Phone" value={form.phone || ''} onChange={set('phone')} />
          <Field label="WhatsApp" value={form.whatsapp || ''} onChange={set('whatsapp')} />
          <Field label="Email" type="email" value={form.email || ''} onChange={set('email')} />
          <Field label="Nationality" value={form.nationality || ''} onChange={set('nationality')} />
          <Field label="Date of Birth" type="date" value={form.date_of_birth || ''} onChange={set('date_of_birth')} />
          <Field label="Blood Group" value={form.blood_group || ''} onChange={set('blood_group')} />
          <div className="col-span-2"><Field label="Address" value={form.address || ''} onChange={set('address')} /></div>
          <Field label="Emergency Contact" value={form.emergency_contact || ''} onChange={set('emergency_contact')} />
          <Field label="Emergency Phone" value={form.emergency_phone || ''} onChange={set('emergency_phone')} />
        </Section>

        <Section title={t('drivers.sectionEmployment')}>
          <Field label="Department" value={form.department || ''} onChange={set('department')} />
          <Field label="Designation" value={form.designation || ''} onChange={set('designation')} />
          <Field label="Joining Date" type="date" value={form.joining_date || ''} onChange={set('joining_date')} />
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status</label>
            <Dropdown value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={['Active', 'Inactive', 'On Leave', 'Terminated']} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Assigned Vehicle</label>
            <Dropdown value={form.assigned_car_id || ''} onChange={v => setForm(f => ({ ...f, assigned_car_id: v }))} placeholder="— None —"
              options={[['', '— None —'], ...cars.map(c => [c.id, c.vehicle_number + ' — ' + c.name])]} />
          </div>
          <Field label="Experience (years)" type="number" value={form.experience_years ?? ''} onChange={set('experience_years')} />
          <Field label="Driving Category" value={form.driving_category || ''} onChange={set('driving_category')} />
        </Section>

        <Section title={t('drivers.sectionLicense')}>
          <Field label="License Number" value={form.license_number || ''} onChange={set('license_number')} />
          <Field label="License Type" value={form.license_type || ''} onChange={set('license_type')} />
          <Field label="Issue Date" type="date" value={form.license_issue_date || ''} onChange={set('license_issue_date')} />
          <Field label="Expiry Date" type="date" value={form.license_expiry_date || ''} onChange={set('license_expiry_date')} />
        </Section>

        <Section title={t('drivers.sectionIqama')}>
          <Field label="Iqama Number" value={form.iqama_number || ''} onChange={set('iqama_number')} />
          <Field label="Iqama Expiry" type="date" value={form.iqama_expiry_date || ''} onChange={set('iqama_expiry_date')} />
          <Field label="Passport Number" value={form.passport_number || ''} onChange={set('passport_number')} />
          <Field label="Passport Expiry" type="date" value={form.passport_expiry_date || ''} onChange={set('passport_expiry_date')} />
          <Field label="Medical Expiry" type="date" value={form.medical_expiry_date || ''} onChange={set('medical_expiry_date')} />
        </Section>

        <div>
          <label className="block text-xs text-slate-500 mb-1">{t('drivers.notes')}</label>
          <textarea value={form.notes || ''} onChange={set('notes')} rows={2} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
        </div>

        <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-white dark:bg-[#0f172a] pb-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm">{t('drivers.cancel')}</button>
          <button disabled={busy} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm">{busy ? t('drivers.saving') : t('drivers.save')}</button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <fieldset className="border border-black/10 dark:border-white/10 rounded-xl p-4">
      <legend className="text-xs font-semibold text-slate-500 px-1">{title}</legend>
      <div className="grid grid-cols-2 gap-3 mt-1">{children}</div>
    </fieldset>
  );
}
function Field({ label, ...props }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input {...props} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
    </div>
  );
}
