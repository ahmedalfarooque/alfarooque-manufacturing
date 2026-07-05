'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { useLiveData } from '@/lib/useLiveData';
import { expiryInfo } from '@/lib/expiry';
import { DriverModal } from '@/app/(protected)/drivers/page';

const STATUS_BADGE = {
  Active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Inactive: 'bg-slate-500/10 text-slate-500',
  'On Leave': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Terminated: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const PHOTO_SLOTS = [
  { key: 'profile_photo', label: 'Profile Photo', urlField: 'profile_photo_url' },
  { key: 'license_front', label: 'License (Front)', urlField: 'license_front_url' },
  { key: 'license_back', label: 'License (Back)', urlField: 'license_back_url' },
  { key: 'iqama_front', label: 'Iqama (Front)', urlField: 'iqama_front_url' },
  { key: 'iqama_back', label: 'Iqama (Back)', urlField: 'iqama_back_url' },
];

export default function DriverViewPage() {
  const { id } = useParams();
  const [me, setMe] = useState(null);
  const [cars, setCars] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [uploadSlot, setUploadSlot] = useState(null);
  const [uploadErr, setUploadErr] = useState(null);
  const fileRef = useRef(null);

  const { data, error, refresh } = useLiveData('/api/drivers/' + id, 15000);
  const isAdmin = me?.role === 'admin';

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
    fetch('/api/cars?pageSize=100', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setCars(d.vehicles || [])).catch(() => {});
  }, []);

  async function saveDriver(form, mode, driverId) {
    const res = await fetch(`/api/drivers/${driverId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(form),
    });
    const respData = await res.json();
    if (!res.ok) throw new Error(respData.error);
    setEditOpen(false);
    refresh();
  }

  function triggerUpload(slot) {
    setUploadSlot(slot);
    setTimeout(() => fileRef.current?.click(), 0);
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file || !uploadSlot) return;
    setUploadErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('slot', uploadSlot);
      const res = await fetch(`/api/drivers/${id}/photo`, { method: 'POST', credentials: 'same-origin', body: fd });
      const respData = await res.json();
      if (!res.ok) throw new Error(respData.error);
      refresh();
    } catch (err) {
      setUploadErr(err.message);
    }
    setUploadSlot(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  if (error) return <Shell active="/drivers"><div className="text-red-500">{error}</div></Shell>;
  if (!data) return <Shell active="/drivers"><div className="text-slate-400">Loading…</div></Shell>;

  const { driver: d, activity } = data;
  const lic = expiryInfo(d.license_expiry_date);
  const iqama = expiryInfo(d.iqama_expiry_date);
  const passport = expiryInfo(d.passport_expiry_date);
  const medical = expiryInfo(d.medical_expiry_date);

  return (
    <Shell active="/drivers">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3 print:hidden">
        <div>
          <a href="/drivers" className="text-xs text-brand-500 hover:underline">← Back to Drivers</a>
          <h2 className="text-lg font-semibold mt-1">{d.full_name}</h2>
          <p className="text-xs text-slate-500">Dashboard &gt; Drivers &gt; {d.full_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={'px-3 py-1.5 rounded-full text-xs font-medium ' + (STATUS_BADGE[d.status] || '')}>{d.status}</span>
          <button onClick={() => window.print()} className="text-sm px-3 py-2 rounded-lg border border-black/10 dark:border-white/10">🖶 Print</button>
          {isAdmin && <button onClick={() => setEditOpen(true)} className="text-sm px-3 py-2 rounded-lg bg-brand-500 text-white">✎ Edit</button>}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 flex flex-col items-center text-center">
          {d.profile_photo_url ? (
            <img src={d.profile_photo_url} alt="" className="h-24 w-24 rounded-full object-cover mb-3 cursor-pointer" onClick={() => setLightbox(d.profile_photo_url)} />
          ) : (
            <div className="h-24 w-24 rounded-full bg-slate-700 text-white flex items-center justify-center text-3xl font-medium mb-3">{d.full_name.slice(0, 1).toUpperCase()}</div>
          )}
          <div className="font-semibold">{d.full_name}</div>
          {d.full_name_ar && <div className="text-sm text-slate-500">{d.full_name_ar}</div>}
          <div className="text-xs text-slate-400 mt-1">{d.designation || '—'} {d.department ? '· ' + d.department : ''}</div>
          <div className="text-xs text-slate-400 mt-1">{d.cars?.vehicle_number ? 'Assigned: ' + d.cars.vehicle_number : 'No vehicle assigned'}</div>
        </div>

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 lg:col-span-2">
          <h3 className="font-medium text-sm mb-3">Expiry Status</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ExpiryBadge label="License" info={lic} />
            <ExpiryBadge label="Iqama" info={iqama} />
            <ExpiryBadge label="Passport" info={passport} />
            <ExpiryBadge label="Medical" info={medical} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Personal Information</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Phone" value={d.phone} /><Row label="WhatsApp" value={d.whatsapp} /><Row label="Email" value={d.email} />
            <Row label="Nationality" value={d.nationality} /><Row label="Date of Birth" value={d.date_of_birth} /><Row label="Blood Group" value={d.blood_group} />
            <Row label="Address" value={d.address} />
            <Row label="Emergency Contact" value={d.emergency_contact} /><Row label="Emergency Phone" value={d.emergency_phone} />
          </dl>
        </div>
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Employment &amp; License</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Employee ID" value={d.employee_id} /><Row label="Joining Date" value={d.joining_date} />
            <Row label="Experience" value={d.experience_years != null ? d.experience_years + ' yrs' : null} />
            <Row label="Driving Category" value={d.driving_category} />
            <Row label="License Number" value={d.license_number} /><Row label="License Type" value={d.license_type} />
            <Row label="License Issue" value={d.license_issue_date} /><Row label="License Expiry" value={d.license_expiry_date} />
            <Row label="Iqama Number" value={d.iqama_number} /><Row label="Iqama Expiry" value={d.iqama_expiry_date} />
            <Row label="Passport Number" value={d.passport_number} /><Row label="Passport Expiry" value={d.passport_expiry_date} />
            <Row label="Medical Expiry" value={d.medical_expiry_date} />
          </dl>
        </div>
      </div>

      {d.notes && (
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4">
          <h3 className="font-medium text-sm mb-2">Notes</h3>
          <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">{d.notes}</p>
        </div>
      )}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4 print:hidden">
        <h3 className="font-medium text-sm mb-3">Photos &amp; Documents</h3>
        {uploadErr && <div className="text-red-500 text-sm mb-2">{uploadErr}</div>}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {PHOTO_SLOTS.map(slot => {
            const url = d[slot.urlField];
            return (
              <div key={slot.key} className="text-center">
                <div onClick={() => url && setLightbox(url)}
                  className="aspect-square rounded-lg border border-black/10 dark:border-white/10 overflow-hidden bg-black/5 dark:bg-white/5 flex items-center justify-center cursor-pointer mb-1">
                  {url ? <img src={url} alt={slot.label} className="w-full h-full object-cover" /> : <span className="text-2xl text-slate-400">📷</span>}
                </div>
                <div className="text-[11px] text-slate-500">{slot.label}</div>
                {isAdmin && <button onClick={() => triggerUpload(slot.key)} className="text-[11px] text-brand-500 hover:underline">{url ? 'Replace' : 'Upload'}</button>}
              </div>
            );
          })}
        </div>
      </div>

      {activity.length > 0 && (
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 print:hidden">
          <h3 className="font-medium text-sm mb-3">Timeline</h3>
          <ul className="space-y-2 text-sm">
            {activity.map(a => (
              <li key={a.id} className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>{a.activity}</span>
                <span className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}

      {editOpen && <DriverModal modal={{ mode: 'edit', data: { ...d, assigned_car_id: d.assigned_car_id || '' } }} cars={cars} onClose={() => setEditOpen(false)} onSave={saveDriver} />}
    </Shell>
  );
}

function ExpiryBadge({ label, info }) {
  return (
    <div className={'rounded-lg px-3 py-2 text-center ' + info.className}>
      <div className="text-xs font-medium">{label}</div>
      <div className="text-sm font-semibold">{info.dot} {info.label}</div>
    </div>
  );
}
function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
