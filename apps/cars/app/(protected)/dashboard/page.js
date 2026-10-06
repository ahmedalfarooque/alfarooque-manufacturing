'use client';

import { useState, useEffect, useMemo } from 'react';
import Shell from '@/components/Shell';
import { GlassIcon } from '@/components/GlassIcons';
import { chartTheme } from '@/components/glass';
import { EmptyState } from '@/components/ui';
import { useLiveData } from '@/lib/useLiveData';
import { useLanguage, trEnum, trExpiryDays } from '@/lib/i18n';
import { SeverityPill, DaysText, SEVERITY_HEX } from '@/components/ExpiryUi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend, AreaChart, Area } from 'recharts';

const STATUS_COLORS = { Running: '#059669', Idle: '#d97706', Stopped: '#dc2626', Offline: '#64748b' };
const BUCKET_COLORS = { expired: '#b91c1c', d0_7: '#dc2626', d8_15: '#ea580c', d16_30: '#d97706', d31_90: '#2563eb', d91_plus: '#059669', missing: '#94a3b8' };
const BUCKET_ORDER = ['expired', 'd0_7', 'd8_15', 'd16_30', 'd31_90', 'd91_plus', 'missing'];
const TYPE_COLOR = { insurance: '#2563eb', inspection: '#0891b2' };
const REFRESH_MS = 15000;

export default function DashboardPage() {
  const { t, formatDateOnly, formatNumber } = useLanguage();
  const { data: stats, error } = useLiveData('/api/stats', REFRESH_MS);
  const [dark, setDark] = useState(false);
  const [me, setMe] = useState(null);

  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains('dark'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);
  const isAdmin = me?.role === 'admin';
  const ct = chartTheme(dark);

  const fe = stats?.fleetExpiry;
  const timeline = useMemo(() => {
    const weeks = [{ k: 'w1', max: 7 }, { k: 'w2', max: 14 }, { k: 'w3', max: 21 }, { k: 'w4', max: 30 }].map(w => ({ ...w, insurance: 0, inspection: 0 }));
    for (const a of fe?.expiringWithin30 || []) {
      const w = weeks.find(x => a.daysRemaining <= x.max);
      if (w) w[a.alertType]++;
    }
    return weeks.map((w, i) => ({ name: t('dx.week', { n: i + 1 }), range: ['0–7', '8–14', '15–21', '22–30'][i], insurance: w.insurance, inspection: w.inspection }));
  }, [fe, t]);

  if (error) return <Shell active="/dashboard"><div className="text-red-500">{error}</div></Shell>;
  if (!stats) return <Shell active="/dashboard"><div className="text-[color:var(--tx-3)]">{t('dash.loadingDashboard')}</div></Shell>;

  const ins = fe.summary.insurance, insp = fe.summary.inspection;
  const sev = fe.summary.severity;
  const statusData = Object.entries(stats.statusBreakdown).filter(([, v]) => v > 0).map(([key, value]) => ({ key, name: trEnum(t, 'status', key), value }));
  const monthlyCost = (stats.monthlyMaintenanceCost || []).map(m => ({ month: m.month.slice(5), cost: m.cost }));
  const driverDocs = (stats.notifications || []).filter(n => n.category !== 'Insurance' && n.category !== 'Registration');
  const sevData = ['expired', 'critical', 'urgent', 'warning'].map(k => ({ key: k, name: t('severity.' + k), value: sev[k] || 0 })).filter(d => d.value > 0);
  const tip = { contentStyle: ct.tooltip, labelStyle: { color: ct.axis }, itemStyle: { color: ct.tooltip.color }, cursor: { fill: ct.primarySoft } };
  const kpi = (n) => formatNumber(n);

  return (
    <Shell active="/dashboard">
      {/* Header + shortcuts */}
      <div className="flex items-start justify-between gap-3 flex-wrap mb-4 gfade-up">
        <div>
          <h2 className="text-lg font-semibold">{t('nav.dashboard')}</h2>
          <p className="text-xs text-[color:var(--tx-3)]">{t('dx.today')}: <span className="font-medium text-[color:var(--tx-2)]">{formatDateOnly(fe.today)}</span></p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Shortcut href="/vehicles" icon="truck" label={t('vehicles.addVehicle')} />
          <Shortcut href="/drivers" icon="users" label={t('drivers.addDriver')} />
          <Shortcut href="/maintenance" icon="wrench" label={t('maint.addRecord')} />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5 gfade-up" data-testid="kpi-strip">
        <Kpi href="/vehicles" label={t('dx.kpi.total')} value={kpi(stats.totalVehicles)} icon="truck" />
        <Kpi href="/insurance?filter=expiring30" label={t('dx.kpi.insExpiring')} value={kpi(ins.expiringSoon)} sub={t('dx.kpi.within30')} tone={ins.expiringSoon ? 'amber' : null} icon="shield" />
        <Kpi href="/inspection?filter=expiring30" label={t('dx.kpi.inspExpiring')} value={kpi(insp.expiringSoon)} sub={t('dx.kpi.within30')} tone={insp.expiringSoon ? 'amber' : null} icon="target" />
        <Kpi href="/insurance?filter=expired" label={t('dx.kpi.insExpired')} value={kpi(ins.expired)} tone={ins.expired ? 'red' : null} icon="shield" />
        <Kpi href="/inspection?filter=expired" label={t('dx.kpi.inspExpired')} value={kpi(insp.expired)} tone={insp.expired ? 'red' : null} icon="target" />
        <Kpi href="/vehicles?status=Running" label={t('dash.running')} value={kpi(stats.running)} dot={STATUS_COLORS.Running} />
        <Kpi href="/vehicles?status=Idle" label={t('dash.idle')} value={kpi(stats.idle)} dot={STATUS_COLORS.Idle} />
        <Kpi href="/vehicles?status=Stopped" label={t('dash.stopped')} value={kpi(stats.stopped)} dot={STATUS_COLORS.Stopped} />
        <Kpi href="/alerts" label={t('dx.kpi.activeAlerts')} value={kpi(stats.activeAlerts)} sub={t('dx.kpi.activeAlertsSub', { expiry: stats.expiryAlertCount, system: stats.unreadSystemAlerts })} tone={stats.activeAlerts ? 'red' : null} icon="bell" />
        <Kpi href="/maintenance-schedule" label={t('dx.kpi.maintDue')} value={kpi(stats.maintenanceDueVehicleCount)} sub={t('dx.kpi.maintDueSub', { items: stats.maintenanceDueCount, vehicles: stats.maintenanceDueVehicleCount })} tone={stats.maintenanceDueVehicleCount ? 'amber' : null} icon="wrench" />
      </div>

      {/* EXPIRING WITHIN 30 DAYS — the actual vehicles, not just a count */}
      <section className="glass-card mb-5 gfade-up border-s-4 border-s-amber-500" aria-labelledby="exp30-title" data-testid="expiring-30">
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 lg:px-5 pt-4">
          <div>
            <h3 id="exp30-title" className="font-semibold text-[15px] uppercase tracking-wide">{t('dx.expiring30.title')}</h3>
            <p className="text-xs text-[color:var(--tx-3)] mt-0.5">{t('dx.expiring30.sub')}</p>
          </div>
          <span className={'px-3 py-1 rounded-full text-sm font-semibold tabular-nums ' + (fe.expiringWithin30.length ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300')}>{fe.expiringWithin30.length}</span>
        </div>
        <Expiring30Body rows={fe.expiringWithin30} isAdmin={isAdmin} />
      </section>

      {fe.expired.length > 0 && (
        <section className="glass-card mb-5 gfade-up border-s-4 border-s-red-600" aria-labelledby="expd-title" data-testid="expired-list">
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 lg:px-5 pt-4">
            <div>
              <h3 id="expd-title" className="font-semibold text-[15px] uppercase tracking-wide">{t('dx.expired.title')}</h3>
              <p className="text-xs text-[color:var(--tx-3)] mt-0.5">{t('dx.expired.sub')}</p>
            </div>
            <span className="px-3 py-1 rounded-full text-sm font-semibold tabular-nums bg-red-500/10 text-red-700 dark:text-red-300">{fe.expired.length}</span>
          </div>
          <AlertTable rows={fe.expired} empty={t('dx.expired.empty')} isAdmin={isAdmin} />
        </section>
      )}

      {/* Insurance / Inspection distribution */}
      <div className="grid lg:grid-cols-2 gap-4 mb-5 gfade-up">
        <DistributionCard title={t('dx.insuranceCard')} href="/insurance" summary={ins} ct={ct} tip={tip} t={t} icon="shield" />
        <DistributionCard title={t('dx.inspectionCard')} href="/inspection" summary={insp} ct={ct} tip={tip} t={t} icon="target" />
      </div>

      {/* Timeline / severity / fleet status */}
      <div className="grid lg:grid-cols-3 gap-4 mb-5 gfade-up">
        <Card title={t('dx.timeline')} sub={t('dx.timelineSub')}>
          {fe.expiringWithin30.length === 0 ? <NoData t={t} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={timeline} margin={{ left: -10, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                <XAxis dataKey="range" stroke={ct.axis} tick={{ fontSize: 11, fill: ct.axis }} />
                <YAxis stroke={ct.axis} tick={{ fontSize: 11, fill: ct.axis }} allowDecimals={false} />
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="insurance" name={t('alertType.insurance')} stackId="a" fill={TYPE_COLOR.insurance} />
                <Bar dataKey="inspection" name={t('alertType.inspection')} stackId="a" fill={TYPE_COLOR.inspection} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card title={t('dx.severityDist')}>
          {sevData.length === 0 ? <NoData t={t} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sevData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>
                  {sevData.map(d => <Cell key={d.key} fill={SEVERITY_HEX[d.key]} />)}
                </Pie>
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card title={t('dx.fleetStatus')}>
          {statusData.length === 0 ? <NoData t={t} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>
                  {statusData.map(d => <Cell key={d.key} fill={STATUS_COLORS[d.key] || '#94a3b8'} />)}
                </Pie>
                <Tooltip {...tip} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Maintenance + recent alerts */}
      <div className="grid lg:grid-cols-3 gap-4 mb-5 gfade-up">
        <Card title={t('dx.maintenance')} className="lg:col-span-2" action={<a href="/maintenance-schedule" className="text-xs text-brand-500 hover:underline">{t('dx.viewAll')}</a>}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Mini label={t('dx.maintOverdue')} value={stats.overdueServices} tone={stats.overdueServices ? 'red' : null} />
            <Mini label={t('dx.maintUpcoming')} value={stats.upcomingServices} tone={stats.upcomingServices ? 'amber' : null} />
            <Mini label={t('dx.maintInWorkshop')} value={stats.vehiclesInWorkshop} />
            <Mini label={t('dx.maintThisMonth')} value={'SAR ' + formatNumber(stats.thisMonthMaintenanceCost)} />
          </div>
          {monthlyCost.some(m => m.cost > 0) ? (
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={monthlyCost} margin={{ left: -10, right: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                <XAxis dataKey="month" stroke={ct.axis} tick={{ fontSize: 11, fill: ct.axis }} />
                <YAxis stroke={ct.axis} tick={{ fontSize: 11, fill: ct.axis }} />
                <Tooltip {...tip} />
                <Area type="monotone" dataKey="cost" name={t('dash.maintenanceCost')} stroke={ct.primary} fill={ct.primary} fillOpacity={0.18} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <NoData t={t} />}
        </Card>
        <Card title={t('dx.recentAlerts')} action={<a href="/alerts" className="text-xs text-brand-500 hover:underline">{t('dx.viewAll')}</a>}>
          {(stats.recentAlerts || []).length === 0 ? <div className="text-sm text-[color:var(--tx-3)] py-6 text-center">{t('dash.noAlertsYet')}</div> : (
            <ul className="space-y-3">
              {stats.recentAlerts.map(a => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
                  <GlassIcon name="bell" size={20} bare className="shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{a.title}</div>
                    <div className="text-xs text-[color:var(--tx-3)] line-clamp-2">{a.body}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Driver documents + operations */}
      <div className="grid lg:grid-cols-3 gap-4 gfade-up">
        <Card title={t('dx.driverDocs')} className="lg:col-span-2">
          {driverDocs.length === 0 ? <div className="text-sm text-[color:var(--tx-3)] py-4 text-center">{t('dx.driverDocsEmpty')}</div> : (
            <ul className="divide-y divide-[color:var(--bd)]">
              {driverDocs.map((n, i) => (
                <li key={i}>
                  <a href={n.href} className="flex items-center justify-between gap-3 py-2.5 hover:bg-[color:var(--pr-soft)] -mx-1 px-1 rounded-lg transition">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: n.level === 'red' ? '#dc2626' : '#ea580c' }} aria-hidden="true" />
                      <span className="font-medium truncate">{n.entityName}</span>
                      <span className="text-[color:var(--tx-3)] text-xs">{trEnum(t, 'expiryCat', n.category)}</span>
                    </div>
                    <span className="text-xs text-[color:var(--tx-3)] shrink-0">{trExpiryDays(t, n.days)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={t('dx.operations')}>
          <dl className="space-y-2.5 text-sm">
            <Op label={t('dash.totalDistance')} value={Number(stats.totalDistance) > 0 ? formatNumber(stats.totalDistance) + ' ' + t('common.km') : null} t={t} />
            <Op label={t('dash.totalTrips')} value={stats.totalTrips > 0 ? formatNumber(stats.totalTrips) : null} t={t} />
            <Op label={t('dash.avgSpeed')} value={stats.avgSpeed != null ? stats.avgSpeed + ' ' + t('common.kmh') : null} t={t} />
            <Op label={t('dash.fuelConsumed')} value={Number(stats.fuelConsumed) > 0 ? formatNumber(stats.fuelConsumed) + ' ' + t('common.liter') : null} t={t} />
            <Op label={t('dash.fuelCost')} value={Number(stats.fuelCost) > 0 ? 'SAR ' + formatNumber(stats.fuelCost) : null} t={t} />
            <Op label={t('dash.totalDrivers')} value={stats.totalDrivers > 0 ? formatNumber(stats.totalDrivers) : null} t={t} />
          </dl>
        </Card>
      </div>
    </Shell>
  );
}

/* ── pieces ── */

function Shortcut({ href, icon, label }) {
  return (
    <a href={href} className="glass-ctrl !h-9 gap-2" aria-label={label} title={label}>
      <GlassIcon name={icon} size={16} bare className="ctrl-icon" /><span className="ctrl-label">{label}</span>
    </a>
  );
}

function Kpi({ href, label, value, sub, tone, icon, dot }) {
  const accent = tone === 'red' ? '#dc2626' : tone === 'amber' ? '#d97706' : 'var(--bd-2)';
  const valueCls = tone === 'red' ? 'text-red-600 dark:text-red-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-[color:var(--tx)]';
  return (
    <a href={href} className="glass-card glass-card--pad relative overflow-hidden flex flex-col gap-1 hover:shadow-md transition-shadow">
      <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: dot || accent }} aria-hidden="true" />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[color:var(--tx-3)] leading-snug">{label}</span>
        {icon && <GlassIcon name={icon} size={20} bare className="shrink-0 opacity-80" />}
      </div>
      <div className={'text-2xl font-semibold tabular-nums leading-none mt-1 ' + valueCls}>{value}</div>
      {sub && <div className="text-[10.5px] text-[color:var(--tx-4)] leading-snug mt-0.5">{sub}</div>}
    </a>
  );
}

function Card({ title, sub, children, className = '', action }) {
  return (
    <div className={'glass-card glass-card--pad ' + className}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-semibold text-sm">{title}</h3>
          {sub && <p className="text-[11px] text-[color:var(--tx-4)] mt-0.5">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function NoData({ t }) { return <div className="text-sm text-[color:var(--tx-3)] py-10 text-center">{t('fleet.noData')}</div>; }

function Mini({ label, value, tone }) {
  const cls = tone === 'red' ? 'text-red-600 dark:text-red-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-[color:var(--tx)]';
  return (
    <div className="rounded-lg bg-[color:var(--pr-soft)]/50 px-3 py-2.5">
      <div className={'text-lg font-semibold tabular-nums ' + cls}>{value}</div>
      <div className="text-[11px] text-[color:var(--tx-3)] mt-0.5">{label}</div>
    </div>
  );
}

function Op({ label, value, t }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[color:var(--tx-3)]">{label}</dt>
      <dd className={value ? 'font-medium' : 'text-[color:var(--tx-4)] text-xs'}>{value || t('dx.notTracked')}</dd>
    </div>
  );
}

function DistributionCard({ title, href, summary, ct, tip, t, icon }) {
  const data = BUCKET_ORDER.map(k => ({ key: k, name: t('dx.bucket.' + k), value: summary.buckets[k] }));
  const hasData = summary.total > 0;
  return (
    <Card title={title} action={<a href={href} className="text-xs text-brand-500 hover:underline">{t('dx.cardLink')}</a>}>
      <div className="grid grid-cols-4 gap-2 mb-3">
        <Mini label={t('fleet.kpi.valid')} value={summary.valid} />
        <Mini label={t('fleet.kpi.expiring')} value={summary.expiringSoon} tone={summary.expiringSoon ? 'amber' : null} />
        <Mini label={t('fleet.kpi.expired')} value={summary.expired} tone={summary.expired ? 'red' : null} />
        <Mini label={t('fleet.kpi.missing')} value={summary.missingDate} />
      </div>
      {!hasData ? <NoData t={t} /> : (
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={data} margin={{ left: -18, right: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
            <XAxis dataKey="name" stroke={ct.axis} tick={{ fontSize: 10, fill: ct.axis }} interval={0} />
            <YAxis stroke={ct.axis} tick={{ fontSize: 11, fill: ct.axis }} allowDecimals={false} />
            <Tooltip {...tip} />
            <Bar dataKey="value" name={title} radius={[4, 4, 0, 0]}>
              {data.map(d => <Cell key={d.key} fill={BUCKET_COLORS[d.key]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

/* Severity counts + Insurance / Inspection tabs above the 30-day table. */
function Expiring30Body({ rows, isAdmin }) {
  const { t } = useLanguage();
  const [type, setType] = useState('all');
  const count = k => rows.filter(a => a.severity === k).length;
  const shown = type === 'all' ? rows : rows.filter(a => a.alertType === type);
  const tabs = [['all', t('fleet.filter.all'), rows.length], ['insurance', t('alertType.insurance'), rows.filter(a => a.alertType === 'insurance').length], ['inspection', t('alertType.inspection'), rows.filter(a => a.alertType === 'inspection').length]];
  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 lg:px-5 mt-3">
        <div role="tablist" aria-label={t('dx.expiring30.title')} className="flex gap-1">
          {tabs.map(([k, label, n]) => (
            <button key={k} role="tab" aria-selected={type === k} onClick={() => setType(k)}
              className={'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--pr)] ' + (type === k ? 'bg-[color:var(--pr-soft)] border-[color:var(--pr)] text-[color:var(--tx)]' : 'border-[color:var(--bd)] text-[color:var(--tx-3)] hover:text-[color:var(--tx)]')}>
              {label} <span className="tabular-nums opacity-80">({n})</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap" aria-label={t('dx.sevSummary')}>
          {['critical', 'urgent', 'warning'].map(k => (
            <span key={k} className="inline-flex items-center gap-1.5"><SeverityPill severity={k} /><span className="tabular-nums text-sm font-semibold">{count(k)}</span></span>
          ))}
        </div>
      </div>
      <AlertTable rows={shown} empty={t('dx.expiring30.empty')} isAdmin={isAdmin} />
    </>
  );
}

/* Table on ≥ md, stacked cards on phones. Sorted most urgent first by the
   server; a vehicle with both documents expiring appears once per alert. */
function AlertTable({ rows, empty, isAdmin }) {
  const { t, formatDateOnly } = useLanguage();
  if (rows.length === 0) return <div className="px-5 pb-5 pt-2"><EmptyState text={empty} /></div>;
  return (
    <>
      <div className="overflow-auto max-h-[420px] hidden md:block mt-3">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl">
            <tr className="text-start">
              {['vehicle', 'alertType', 'expiry', 'days', 'status', 'action'].map((k, i) => (
                <th key={k} className={'px-4 py-2.5 text-[11px] uppercase tracking-wider text-[color:var(--tx-3)] font-semibold whitespace-nowrap ' + (i === 5 ? 'text-end' : 'text-start')}>{t('dx.col.' + k)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(a => (
              <tr key={a.key} className="border-t border-[color:var(--bd)] hover:bg-[color:var(--pr-soft)] transition-colors">
                <td className="px-4 py-2.5"><a href={'/vehicles/' + a.carId} className="font-medium hover:underline">{a.vehicleNumber}</a><div className="text-xs text-[color:var(--tx-3)]">{a.vehicleName || '—'}</div></td>
                <td className="px-4 py-2.5 whitespace-nowrap"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-sm" style={{ background: TYPE_COLOR[a.alertType] }} aria-hidden="true" />{t('alertType.' + a.alertType)}</span></td>
                <td className="px-4 py-2.5 whitespace-nowrap">{formatDateOnly(a.expiryDate)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap"><DaysText days={a.daysRemaining} /></td>
                <td className="px-4 py-2.5"><SeverityPill severity={a.severity} /></td>
                <td className="px-4 py-2.5 text-end whitespace-nowrap">
                  <a href={'/vehicles/' + a.carId} className="text-xs font-medium text-brand-500 hover:underline">{t('fleet.view')}</a>
                  {isAdmin && <a href={'/vehicles/' + a.carId + '?edit=1'} className="text-xs font-medium text-brand-500 hover:underline ms-3">{t('fleet.edit')}</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="md:hidden divide-y divide-[color:var(--bd)] mt-3">
        {rows.map(a => (
          <li key={a.key}>
            <a href={'/vehicles/' + a.carId} className="block px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><div className="font-medium truncate">{a.vehicleNumber}</div><div className="text-xs text-[color:var(--tx-3)] truncate">{a.vehicleName || '—'}</div></div>
                <SeverityPill severity={a.severity} />
              </div>
              <div className="flex items-center justify-between gap-3 mt-2 text-xs">
                <span className="inline-flex items-center gap-2 text-[color:var(--tx-2)]"><span className="h-2 w-2 rounded-sm" style={{ background: TYPE_COLOR[a.alertType] }} aria-hidden="true" />{t('alertType.' + a.alertType)}</span>
                <span className="text-[color:var(--tx-3)]">{formatDateOnly(a.expiryDate)} · <DaysText days={a.daysRemaining} /></span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
