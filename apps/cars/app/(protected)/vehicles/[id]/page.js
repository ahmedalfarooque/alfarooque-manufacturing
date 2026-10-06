'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { useLiveData } from '@/lib/useLiveData';
import { expiryInfo } from '@/lib/expiry';
import { VehicleModal } from '@/app/(protected)/vehicles/page';
import { useLanguage, trEnum, trExpiry } from '@/lib/i18n';
import { Button } from '@/components/ui';
import { GlassIcon } from '@/components/GlassIcons';
import { StatusPill, SeverityPill, DaysText, Notice } from '@/components/ExpiryUi';

const STATUS_BADGE = {
  Running: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Idle: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Stopped: 'bg-red-500/10 text-red-600 dark:text-red-400',
  Offline: 'bg-slate-500/10 text-[color:var(--tx-3)]',
};
const LEVEL_DOT = { none: '#94a3b8', green: '#059669', yellow: '#ca8a04', orange: '#ea580c', red: '#dc2626' };

export default function VehicleViewPage() {
  const { t, formatDate, formatDateTime, formatDateOnly, formatNumber } = useLanguage();
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

  /* The Insurance / Inspection lists link here with ?edit=1. */
  useEffect(() => {
    if (isAdmin && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('edit') === '1') setEditOpen(true);
  }, [isAdmin]);

  async function saveVehicle(form, mode, vehicleId) {
    const res = await fetch(`/api/cars/${vehicleId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(form),
    });
    const respData = await res.json();
    if (!res.ok) throw Object.assign(new Error(respData.error), { field: respData.field, code: respData.code });
    setEditOpen(false);
    refresh();
  }

  if (error) return <Shell active="/vehicles"><div className="text-[#ef4444]">{error}</div></Shell>;
  if (!data) return <Shell active="/vehicles"><div className="text-[color:var(--tx-3)]">{t('common.loading')}</div></Shell>;

  const { vehicle: v, maintenanceLog, trips, alerts, expiry } = data;
  const registration = expiryInfo(v.registration_expiry);
  const ins = expiry.insurance;
  const insp = expiry.inspection;
  const inspectionColumns = 'periodic_inspection_expiry' in v;
  const notSet = <span className="text-[color:var(--tx-4)]">{t('expiry.notSet')}</span>;
  const vehicleAlerts = [ins, insp].filter(r => r.isActive);
  const maintAlerts = expiry.maintenanceAlerts || [];
  const hasAnyAlert = vehicleAlerts.length > 0 || maintAlerts.length > 0;

  return (
    <Shell active="/vehicles">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3 print:hidden">
        <div>
          <a href="/vehicles" className="text-xs text-brand-500 hover:underline">{t('vehicleView.back')}</a>
          <h2 className="text-lg font-semibold mt-1">{v.vehicle_number}</h2>
          <p className="text-xs text-[color:var(--tx-3)]">{t('vehicleView.breadcrumb', { name: v.vehicle_number })}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={'px-3 py-1.5 rounded-full text-xs font-medium ' + (STATUS_BADGE[v.status] || '')}>{trEnum(t, 'status', v.status)}</span>
          <Button variant="ghost" onClick={() => window.print()} icon={<GlassIcon name="receipt" size={16} bare />}>{t('common.print')}</Button>
          {isAdmin && <Button onClick={() => setEditOpen(true)} icon={<GlassIcon name="edit" size={16} bare />}>{t('common.edit')}</Button>}
        </div>
      </div>

      {expiry.schemaReady === false && <div className="mb-4 print:hidden"><Notice>{t('fleet.schemaPending')}</Notice></div>}

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <div className="glass-card glass-card--pad flex flex-col items-center text-center">
          <span className="icon-tile icon-tile--lg mb-3"><GlassIcon name="truck" size={26} bare /></span>
          <div className="font-semibold">{v.name || v.vehicle_number}</div>
          <div className="text-xs text-[color:var(--tx-3)]">{trEnum(t, 'vtype', v.type)} · {trEnum(t, 'fuel', v.fuel_type)}</div>
          <div className="text-xs text-[color:var(--tx-3)] mt-1">{v.drivers?.full_name ? t('vehicleView.driverPrefix', { name: v.drivers.full_name }) : (v.driver || t('vehicleView.noDriver'))}</div>
          <div className="text-xs text-[color:var(--tx-3)] mt-1">{v.location || '—'}</div>
        </div>

        {/* Alerts — insurance, periodic inspection and maintenance for THIS vehicle */}
        <div className="glass-card glass-card--pad lg:col-span-2" data-testid="vehicle-alerts">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm">{t('vd.alertsTitle')}</h3>
            {hasAnyAlert && <span className="text-xs text-[color:var(--tx-3)]">{t('al.activeCount', { n: vehicleAlerts.length + maintAlerts.length })}</span>}
          </div>
          {!hasAnyAlert ? (
            <div className="text-sm text-[color:var(--tx-3)] py-3">{t('vd.noAlerts')}</div>
          ) : (
            <ul className="divide-y divide-[color:var(--bd)]">
              {vehicleAlerts.map(r => (
                <li key={r.alertType} className="py-3 grid gap-x-4 gap-y-2 sm:grid-cols-[1.2fr_1fr_1fr_1.2fr] items-start">
                  <div>
                    <div className="text-sm font-medium">{t('alertType.' + r.alertType)}</div>
                    <div className="mt-1"><SeverityPill severity={r.severity} /></div>
                  </div>
                  <Mini label={t('fleet.col.expiry')}>{formatDateOnly(r.expiryDate)}</Mini>
                  <Mini label={t('fleet.col.days')}><DaysText days={r.daysRemaining} /></Mini>
                  <Mini label={t('vd.emailNotification')}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: r.notification?.emailActive ? '#059669' : '#94a3b8' }} aria-hidden="true" />
                      {r.notification?.emailActive ? t('vd.on') : t('vd.off')}
                    </span>
                    {expiry.schemaReady !== false && (
                      <span className="block text-[11px] text-[color:var(--tx-4)] mt-0.5">
                        {r.notification?.lastNotifiedOn ? t('vd.lastNotified') + ': ' + formatDateOnly(r.notification.lastNotifiedOn) : t('vd.neverNotified')}
                      </span>
                    )}
                  </Mini>
                </li>
              ))}
              {maintAlerts.map(m => (
                <li key={m.id} className="py-3 grid gap-x-4 gap-y-2 sm:grid-cols-[1.2fr_1fr_1fr_1.2fr] items-start">
                  <div>
                    <div className="text-sm font-medium">{t('alertType.maintenance')}</div>
                    <div className="text-xs text-[color:var(--tx-3)] mt-1">{m.maintenanceType}</div>
                  </div>
                  <Mini label={t('fleet.col.expiry')}>—</Mini>
                  <Mini label={t('fleet.col.days')}>
                    <span className={m.overdue ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-amber-600 dark:text-amber-400 font-medium'}>
                      {m.overdue ? t('vd.overdueKm', { km: formatNumber(Math.abs(m.remainingKm)) }) : t('vd.remainingKm', { km: formatNumber(m.remainingKm) })}
                    </span>
                  </Mini>
                  <Mini label={t('vd.emailNotification')}>—</Mini>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3">{t('vd.insuranceCard')}</h3>
          <dl className="space-y-2 text-sm">
            <Row label={t('fields.insuranceCompany')} value={ins.company} empty={notSet} />
            <Row label={t('fields.insuranceNumber')} value={ins.policyNumber} empty={notSet} />
            <Row label={t('fields.insuranceStartDate')} value={ins.startDate ? formatDateOnly(ins.startDate) : null} empty={notSet} />
            <Row label={t('fields.insuranceExpiry')} value={ins.hasDate ? formatDateOnly(ins.expiryDate) : null} empty={notSet} />
            <Row label={t('vd.daysRemaining')} value={ins.hasDate ? <DaysText days={ins.daysRemaining} /> : null} empty={notSet} />
            <Row label={t('vd.status')} value={<StatusPill status={ins.displayStatus} />} />
          </dl>
        </div>
        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3">{t('vd.inspectionCard')}</h3>
          {!inspectionColumns && <div className="mb-3"><Notice>{t('fleet.inspectionSchemaPending')}</Notice></div>}
          <dl className="space-y-2 text-sm">
            <Row label={t('fields.inspectionLast')} value={insp.lastTakenDate ? formatDateOnly(insp.lastTakenDate) : null} empty={notSet} />
            <Row label={t('fields.inspectionExpiry')} value={insp.hasDate ? formatDateOnly(insp.expiryDate) : null} empty={notSet} />
            <Row label={t('vd.daysRemaining')} value={insp.hasDate ? <DaysText days={insp.daysRemaining} /> : null} empty={notSet} />
            <Row label={t('vd.status')} value={<StatusPill status={insp.displayStatus} />} />
          </dl>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="glass-card glass-card--pad">
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
        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3">{t('vehicleView.registration')} · {t('vf.sectionPurchase')}</h3>
          <dl className="space-y-2 text-sm">
            <Row label={t('fields.registrationExpiry')} value={v.registration_expiry ? (
              <span className="inline-flex items-center gap-2">
                {formatDateOnly(v.registration_expiry)}
                <span className="inline-flex items-center gap-1.5 text-xs"><span className="h-1.5 w-1.5 rounded-full" style={{ background: LEVEL_DOT[registration.level] }} aria-hidden="true" />{trExpiry(t, registration)}</span>
              </span>
            ) : null} empty={notSet} />
            <Row label={t('fields.purchaseDate')} value={v.purchase_date ? formatDateOnly(v.purchase_date) : null} />
            <Row label={t('fields.purchaseCost')} value={v.purchase_cost != null ? 'SAR ' + v.purchase_cost : null} />
            <Row label={t('fields.assignedDriver')} value={v.drivers?.full_name} />
            {v.drivers?.phone && <Row label={t('vehicleView.driverPhone')} value={v.drivers.phone} />}
          </dl>
        </div>
      </div>

      <div className="glass-card glass-card--pad mb-4">
        <h3 className="font-medium text-sm mb-3">{t('vd.maintenanceTitle')}</h3>
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
          <Row label={t('fields.lastServiceDate')} value={v.last_service_date ? formatDateOnly(v.last_service_date) : null} empty={notSet} />
          <Row label={t('fields.nextServiceDate')} value={v.next_service_date ? formatDateOnly(v.next_service_date) : null} empty={notSet} />
        </dl>
        <div className="text-xs font-semibold text-[color:var(--tx-3)] uppercase tracking-wide mb-2">{t('vehicleView.maintHistory')}</div>
        {maintenanceLog.length === 0 ? <div className="text-sm text-[color:var(--tx-3)]">{t('vehicleView.noServiceHistory')}</div> : (
          <ul className="space-y-2 text-sm">
            {maintenanceLog.map(m => (
              <li key={m.id} className="flex justify-between text-[color:var(--tx-2)]">
                <span>{m.service_type || m.description || t('vehicleView.service')}</span>
                <span className="text-xs text-[color:var(--tx-3)]">{formatDateOnly(m.service_date)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {v.notes && (
        <div className="glass-card glass-card--pad mb-4">
          <h3 className="font-medium text-sm mb-2">{t('fields.notes')}</h3>
          <p className="text-sm whitespace-pre-wrap text-[color:var(--tx-2)]">{v.notes}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mb-4 print:hidden">
        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3">{t('vehicleView.tripHistory')}</h3>
          {trips.length === 0 ? <div className="text-sm text-[color:var(--tx-3)]">{t('vehicleView.noTrips')}</div> : (
            <ul className="space-y-2 text-sm">
              {trips.map(tr => (
                <li key={tr.id} className="flex justify-between text-[color:var(--tx-2)]">
                  <span>{tr.origin || '—'} → {tr.destination || '—'}</span>
                  <span className="text-xs text-[color:var(--tx-3)]">{formatDate(tr.started_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {alerts.length > 0 && (
          <div className="glass-card glass-card--pad">
            <h3 className="font-medium text-sm mb-3">{t('vehicleView.currentAlerts')}</h3>
            <ul className="space-y-2 text-sm">
              {alerts.map(a => (
                <li key={a.id} className="flex justify-between gap-3 text-[color:var(--tx-2)]">
                  <span>{a.title || a.message}</span>
                  <span className="text-xs text-[color:var(--tx-3)] shrink-0">{formatDateTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

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

function Mini({ label, children }) {
  return (
    <div className="min-w-0 text-sm">
      <div className="text-[11px] text-[color:var(--tx-4)] mb-0.5">{label}</div>
      <div className="text-[color:var(--tx-2)] font-medium">{children}</div>
    </div>
  );
}
function Row({ label, value, empty }) {
  const missing = value === null || value === undefined || value === '';
  if (missing && !empty) return null;
  return (
    <div className="flex justify-between gap-4 items-center">
      <dt className="text-[color:var(--tx-3)]">{label}</dt>
      <dd className="font-medium text-end">{missing ? empty : value}</dd>
    </div>
  );
}
