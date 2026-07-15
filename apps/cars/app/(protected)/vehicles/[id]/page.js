'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { GlassButton } from '@/components/glass';
import { useLiveData } from '@/lib/useLiveData';
import { expiryInfo } from '@/lib/expiry';
import { VehicleModal } from '@/app/(protected)/vehicles/page';
import { useLanguage, trEnum, trExpiry } from '@/lib/i18n';

const STATUS_BADGE = {
  Running: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Idle: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Stopped: 'bg-red-500/10 text-red-600 dark:text-red-400',
  Offline: 'bg-slate-500/10 text-slate-500',
};

export default function VehicleViewPage() {
  const { t, formatDate, formatDateTime } = useLanguage();
  const { id } = useParams();
  const [me, setMe] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [editOpen, setEditOpen] = useState(false);

  const { data, error, refresh } = useLiveData('/api/cars/' + id, 15000);
  const isAdmin = me?.role === 'admin';

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
    fetch('/api/drivers', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setDrivers(d.drivers || [])).catch(() => {});
  }, []);

  async function saveVehicle(form, mode, vehicleId) {
    const res = await fetch(`/api/cars/${vehicleId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(form),
    });
    const respData = await res.json();
    if (!res.ok) throw new Error(respData.error);
    setEditOpen(false);
    refresh();
  }

  if (error) return <Shell active="/vehicles"><div className="text-red-500">{error}</div></Shell>;
  if (!data) return <Shell active="/vehicles"><div className="text-slate-400">{t('common.loading')}</div></Shell>;

  const { vehicle: v, maintenance, maintenanceLog, trips, alerts } = data;
  const insurance = expiryInfo(v.insurance_expiry);
  const registration = expiryInfo(v.registration_expiry);

  return (
    <Shell active="/vehicles">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3 print:hidden">
        <div>
          <a href="/vehicles" className="text-xs text-brand-500 hover:underline">{t('vehicleView.back')}</a>
          <h2 className="text-lg font-semibold mt-1">{v.vehicle_number}</h2>
          <p className="text-xs text-slate-500">{t('vehicleView.breadcrumb', { name: v.vehicle_number })}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={'px-3 py-1.5 rounded-full text-xs font-medium ' + (STATUS_BADGE[v.status] || '')}>{trEnum(t, 'status', v.status)}</span>
          <GlassButton variant="secondary" onClick={() => window.print()} className="text-sm">🖶 {t('common.print')}</GlassButton>
          {isAdmin && <GlassButton variant="primary" onClick={() => setEditOpen(true)} className="text-sm">✎ {t('common.edit')}</GlassButton>}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 flex flex-col items-center text-center">
          <div className="h-24 w-24 rounded-full bg-slate-700 text-white flex items-center justify-center text-2xl font-medium mb-3">🚚</div>
          <div className="font-semibold">{v.name || v.vehicle_number}</div>
          <div className="text-xs text-slate-500">{trEnum(t, 'vtype', v.type)} · {trEnum(t, 'fuel', v.fuel_type)}</div>
          <div className="text-xs text-slate-400 mt-1">{v.drivers?.full_name ? t('vehicleView.driverPrefix', { name: v.drivers.full_name }) : (v.driver || t('vehicleView.noDriver'))}</div>
          <div className="text-xs text-slate-400 mt-1">{v.location || '—'}</div>
        </div>

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 lg:col-span-2">
          <h3 className="font-medium text-sm mb-3">{t('vehicleView.expiryStatus')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <ExpiryBadge label={t('vehicleView.insurance')} info={insurance} />
            <ExpiryBadge label={t('vehicleView.registration')} info={registration} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">{t('vehicleView.vehicleInfo')}</h3>
          <dl className="space-y-2 text-sm">
            <Row label={t('fields.vehicleNumber')} value={v.vehicle_number} /><Row label={t('fields.name')} value={v.name} />
            <Row label={t('fields.type')} value={trEnum(t, 'vtype', v.type)} /><Row label={t('fields.fuelType')} value={trEnum(t, 'fuel', v.fuel_type)} />
            <Row label={t('fields.make')} value={v.make} /><Row label={t('fields.model')} value={v.model} /><Row label={t('fields.year')} value={v.year} />
            <Row label={t('fields.color')} value={v.color} /><Row label={t('fields.serialNumber')} value={v.serial_number} />
            <Row label={t('fields.vinNumber')} value={v.vin_number} /><Row label={t('fields.engineNumber')} value={v.engine_number} />
            <Row label={t('fields.currentKm')} value={v.current_km} /><Row label={t('fields.location')} value={v.location} />
          </dl>
        </div>
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">{t('vehicleView.insuranceRegPurchase')}</h3>
          <dl className="space-y-2 text-sm">
            <Row label={t('fields.insuranceCompany')} value={v.insurance_company} /><Row label={t('fields.insuranceNumber')} value={v.insurance_number} />
            <Row label={t('fields.insuranceExpiry')} value={v.insurance_expiry} /><Row label={t('fields.registrationExpiry')} value={v.registration_expiry} />
            <Row label={t('fields.lastServiceDate')} value={v.last_service_date} /><Row label={t('fields.nextServiceDate')} value={v.next_service_date} />
            <Row label={t('fields.purchaseDate')} value={v.purchase_date} />
            <Row label={t('fields.purchaseCost')} value={v.purchase_cost != null ? 'SAR ' + v.purchase_cost : null} />
            <Row label={t('fields.assignedDriver')} value={v.drivers?.full_name} />
            {v.drivers?.phone && <Row label={t('vehicleView.driverPhone')} value={v.drivers.phone} />}
          </dl>
        </div>
      </div>

      {v.notes && (
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4">
          <h3 className="font-medium text-sm mb-2">{t('fields.notes')}</h3>
          <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">{v.notes}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mb-4 print:hidden">
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">{t('vehicleView.maintHistory')}</h3>
          {maintenanceLog.length === 0 ? <div className="text-sm text-slate-400">{t('vehicleView.noServiceHistory')}</div> : (
            <ul className="space-y-2 text-sm">
              {maintenanceLog.map(m => (
                <li key={m.id} className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>{m.service_type || t('vehicleView.service')}</span>
                  <span className="text-xs text-slate-400">{m.service_date}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">{t('vehicleView.tripHistory')}</h3>
          {trips.length === 0 ? <div className="text-sm text-slate-400">{t('vehicleView.noTrips')}</div> : (
            <ul className="space-y-2 text-sm">
              {trips.map(tr => (
                <li key={tr.id} className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>{tr.origin || '—'} → {tr.destination || '—'}</span>
                  <span className="text-xs text-slate-400">{formatDate(tr.started_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 print:hidden">
          <h3 className="font-medium text-sm mb-3">{t('vehicleView.currentAlerts')}</h3>
          <ul className="space-y-2 text-sm">
            {alerts.map(a => (
              <li key={a.id} className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>{a.message}</span>
                <span className="text-xs text-slate-400">{formatDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editOpen && (
        <VehicleModal
          modal={{ mode: 'edit', data: { ...v, assigned_driver_id: v.assigned_driver_id || '' } }}
          drivers={drivers}
          onClose={() => setEditOpen(false)}
          onSave={saveVehicle}
        />
      )}
    </Shell>
  );
}

function ExpiryBadge({ label, info }) {
  const { t } = useLanguage();
  return (
    <div className={'rounded-lg px-3 py-2 text-center ' + info.className}>
      <div className="text-xs font-medium">{label}</div>
      <div className="text-sm font-semibold">{info.dot} {trExpiry(t, info)}</div>
    </div>
  );
}
function Row({ label, value }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
