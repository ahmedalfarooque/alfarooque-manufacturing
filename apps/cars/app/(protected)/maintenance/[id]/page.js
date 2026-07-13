'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { useLiveData } from '@/lib/useLiveData';
import { useLanguage, trEnum } from '@/lib/i18n';

const PAYMENT_BADGE = {
  Paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Unpaid: 'bg-red-500/10 text-red-600 dark:text-red-400',
  Partial: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

const SLOTS = [
  { key: 'invoice_pdf', labelKey: 'maintView.slotInvoicePdf', accept: 'application/pdf' },
  { key: 'invoice_image', labelKey: 'maintView.slotInvoiceImage', accept: 'image/*' },
  { key: 'before', labelKey: 'maintView.slotBefore', accept: 'image/*' },
  { key: 'during', labelKey: 'maintView.slotDuring', accept: 'image/*' },
  { key: 'after', labelKey: 'maintView.slotAfter', accept: 'image/*' },
  { key: 'document', labelKey: 'maintView.slotDocument', accept: 'image/*,application/pdf' },
];

export default function MaintenanceRecordViewPage() {
  const { t, formatDateTime } = useLanguage();
  const { id } = useParams();
  const [me, setMe] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [uploadSlot, setUploadSlot] = useState(null);
  const [uploadErr, setUploadErr] = useState(null);
  const fileRef = useRef(null);

  const { data, error, refresh } = useLiveData('/api/maintenance-records/' + id, 15000);
  const isAdmin = me?.role === 'admin';

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);

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
      const res = await fetch(`/api/maintenance-records/${id}/attachments`, { method: 'POST', credentials: 'same-origin', body: fd });
      const respData = await res.json();
      if (!res.ok) throw new Error(respData.error);
      refresh();
    } catch (err) {
      setUploadErr(err.message);
    }
    setUploadSlot(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function deleteAttachment(attachmentId) {
    if (!confirm(t('maintView.confirmDeleteAttachment'))) return;
    const res = await fetch(`/api/maintenance-records/${id}/attachments/${attachmentId}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) refresh();
  }

  async function deleteRecord() {
    if (!confirm(t('maint.confirmDelete'))) return;
    const res = await fetch(`/api/maintenance-records/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) window.location.href = '/maintenance';
  }

  if (error) return <Shell active="/maintenance"><div className="text-red-500">{error}</div></Shell>;
  if (!data) return <Shell active="/maintenance"><div className="text-slate-400">{t('common.loading')}</div></Shell>;

  const { record: r, attachments } = data;

  return (
    <Shell active="/maintenance">
      <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3 print:hidden sticky top-16 z-10 bg-[#f3f5f7]/90 dark:bg-[#0b1220]/90 backdrop-blur py-2">
        <div>
          <a href="/maintenance" className="text-xs text-brand-500 hover:underline">{t('maintView.back')}</a>
          <h2 className="text-lg font-semibold mt-1">{r.cars?.vehicle_number} — {r.category}</h2>
          <p className="text-xs text-slate-500">{t('maintView.breadcrumb', { name: r.category })}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={'px-3 py-1.5 rounded-full text-xs font-medium ' + (PAYMENT_BADGE[r.payment_status] || '')}>{trEnum(t, 'payment', r.payment_status)}</span>
          <button onClick={() => window.print()} className="text-sm px-3 py-2 rounded-lg border border-black/10 dark:border-white/10">🖶 {t('common.print')}</button>
          {isAdmin && <button onClick={() => setEditOpen(true)} className="text-sm px-3 py-2 rounded-lg bg-brand-500 text-white">✎ {t('common.edit')}</button>}
          {isAdmin && <button onClick={deleteRecord} className="text-sm px-3 py-2 rounded-lg bg-red-600 text-white">🗑 {t('common.delete')}</button>}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">{t('maintView.vehicleInfo')}</h3>
          <dl className="space-y-2 text-sm">
            <Row label={t('maintView.plateNumber')} value={r.cars?.vehicle_number} />
            <Row label={t('maintView.vehicleName')} value={r.cars?.name} />
            <Row label={t('fields.currentKm')} value={r.cars?.current_km} />
          </dl>
        </div>
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">{t('maintView.driverInfo')}</h3>
          {r.drivers ? (
            <dl className="space-y-2 text-sm">
              <Row label={t('maintView.driverName')} value={r.drivers.full_name} />
              <Row label={t('fields.phone')} value={r.drivers.phone} />
              <Row label={t('fields.licenseNumber')} value={r.drivers.license_number} />
            </dl>
          ) : <div className="text-sm text-slate-400">{t('maintView.noDriver')}</div>}
        </div>
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">{t('maintView.workshopInfo')}</h3>
          {r.maintenance_shops ? (
            <dl className="space-y-2 text-sm">
              <Row label={t('maintView.shopName')} value={r.maintenance_shops.name} />
              <Row label={t('fields.address')} value={r.maintenance_shops.address} />
              <Row label={t('shops.colContact')} value={r.maintenance_shops.contact_person} />
              <Row label={t('fields.phone')} value={r.maintenance_shops.mobile || r.maintenance_shops.telephone} />
              <Row label={t('fields.email')} value={r.maintenance_shops.email} />
              <Row label={t('maintView.vat')} value={r.maintenance_shops.vat_number} />
              <Row label={t('maintView.cr')} value={r.maintenance_shops.cr_number} />
            </dl>
          ) : <div className="text-sm text-slate-400">{t('maintView.noWorkshop')}</div>}
        </div>
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4">
        <h3 className="font-medium text-sm mb-3">{t('maintView.maintInfo')}</h3>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm mb-3">
          <Row label={t('fields.category')} value={r.category} /><Row label={t('fields.maintenanceType')} value={r.maintenance_type} />
          <Row label={t('fields.maintenanceDate')} value={r.maintenance_date} /><Row label={t('fields.odometerKm')} value={r.odometer_km} />
          <Row label={t('fields.technician')} value={r.technician} /><Row label={t('fields.warranty')} value={r.warranty} />
          <Row label={t('maintView.cost')} value={r.currency + ' ' + fmt(r.amount)} /><Row label={t('fields.invoiceNumber')} value={r.invoice_number} />
          <Row label={t('fields.paymentStatus')} value={trEnum(t, 'payment', r.payment_status)} />
        </div>
        {r.work_performed && <Block label={t('fields.workPerformed')} text={r.work_performed} />}
        {r.parts_changed && <Block label={t('maintView.partsUsed')} text={r.parts_changed} />}
        {r.labor_details && <Block label={t('maintView.labor')} text={r.labor_details} />}
      </div>

      {r.notes && (
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4">
          <h3 className="font-medium text-sm mb-2">{t('fields.notes')}</h3>
          <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">{r.notes}</p>
        </div>
      )}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4 print:hidden">
        <h3 className="font-medium text-sm mb-3">{t('maintView.attachments')}</h3>
        {uploadErr && <div className="text-red-500 text-sm mb-2">{uploadErr}</div>}
        {isAdmin && (
          <div className="flex flex-wrap gap-2 mb-4">
            {SLOTS.map(slot => (
              <button key={slot.key} onClick={() => triggerUpload(slot.key)} className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:border-brand-500/40">
                + {t(slot.labelKey)}
              </button>
            ))}
          </div>
        )}
        {attachments.length === 0 ? (
          <div className="text-sm text-slate-400">{t('maintView.noAttachments')}</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {attachments.map(a => (
              <div key={a.id} className="text-center">
                {a.file_name.toLowerCase().endsWith('.pdf') ? (
                  <a href={a.url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-center text-3xl mb-1">📄</a>
                ) : (
                  <div onClick={() => setLightbox(a.url)} className="aspect-square rounded-lg border border-black/10 dark:border-white/10 overflow-hidden bg-black/5 dark:bg-white/5 flex items-center justify-center cursor-pointer mb-1">
                    <img src={a.url} alt={a.file_name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="text-[11px] text-slate-500 truncate">{SLOT_LABEL_KEYS[a.slot] ? t(SLOT_LABEL_KEYS[a.slot]) : a.slot}</div>
                <div className="flex justify-center gap-2 mt-0.5">
                  <a href={a.url} download target="_blank" rel="noreferrer" className="text-[11px] text-brand-500 hover:underline">{t('common.download')}</a>
                  {isAdmin && <button onClick={() => deleteAttachment(a.id)} className="text-[11px] text-red-500 hover:underline">{t('common.delete')}</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 print:hidden">
        <h3 className="font-medium text-sm mb-3">{t('maintView.history')}</h3>
        <dl className="space-y-2 text-sm">
          <Row label={t('maintView.createdDate')} value={formatDateTime(r.created_at)} />
          <Row label={t('maintView.updatedDate')} value={formatDateTime(r.updated_at)} />
          <Row label={t('maintView.createdBy')} value={r.platform_users?.full_name || r.platform_users?.email} />
        </dl>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}

      {editOpen && <EditRedirect id={id} onClose={() => setEditOpen(false)} record={r} refresh={refresh} />}
    </Shell>
  );
}

function EditRedirect({ id, record, onClose, refresh }) {
  const [Modal, setModal] = useState(null);
  const [refs, setRefs] = useState(null);
  useEffect(() => {
    Promise.all([
      import('@/app/(protected)/maintenance/page'),
      fetch('/api/cars?pageSize=100', { credentials: 'same-origin' }).then(r => r.json()),
      fetch('/api/drivers', { credentials: 'same-origin' }).then(r => r.json()),
      fetch('/api/shops', { credentials: 'same-origin' }).then(r => r.json()),
      fetch('/api/categories', { credentials: 'same-origin' }).then(r => r.json()),
    ]).then(([mod, cars, drivers, shops, categories]) => {
      setModal(() => mod.RecordModal);
      setRefs({ cars: cars.vehicles || [], drivers: drivers.drivers || [], shops: shops.shops || [], categories: categories.categories || [] });
    });
  }, []);
  if (!Modal || !refs) return null;
  return (
    <Modal modal={{ mode: 'edit', data: record }} cars={refs.cars} drivers={refs.drivers} shops={refs.shops} categories={refs.categories}
      onShopAdded={() => {}} onClose={onClose} onSaved={() => { onClose(); refresh(); }} />
  );
}

const SLOT_LABEL_KEYS = {
  invoice_pdf: 'maintView.slotInvoicePdf', invoice_image: 'maintView.slotInvoiceImage',
  before: 'maintView.slotBeforeShort', during: 'maintView.slotDuringShort',
  after: 'maintView.slotAfterShort', document: 'maintView.slotDocumentShort',
};
function Row({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
function Block({ label, text }) {
  return (
    <div className="mb-3">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">{text}</p>
    </div>
  );
}
function fmt(n) { return Number(n || 0).toLocaleString(); }
