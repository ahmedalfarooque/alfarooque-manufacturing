'use client';

import Shell from '@/components/Shell';
import StatCard from '@/components/StatCard';
import { useLiveData } from '@/lib/useLiveData';
import { useLanguage } from '@/lib/i18n';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar, AreaChart, Area } from 'recharts';

const COLORS = { Running: '#10b981', Idle: '#f59e0b', Stopped: '#ef4444', Offline: '#64748b' };
const DRIVER_COLORS = { Active: '#10b981', 'On Leave': '#f59e0b', Inactive: '#64748b', Terminated: '#ef4444' };
const LEVEL_COLORS = { green: '#10b981', yellow: '#eab308', orange: '#f97316', red: '#ef4444' };
const LEVEL_DOT = { green: '🟢', yellow: '🟡', orange: '🟠', red: '🔴' };
const REFRESH_MS = 15000; // auto-refresh every 15s, matching the brief's 10-15s live-update requirement

export default function DashboardPage() {
  const { t } = useLanguage();
  const { data: stats, error } = useLiveData('/api/stats', REFRESH_MS);
  const EXPIRY_LABELS = { license: t('dash.licenseExpiring'), iqama: t('dash.iqamaExpiring'), passport: t('dash.passportExpiring'), medical: t('dash.medicalExpiring'), insurance: t('dash.insuranceExpiring'), registration: t('dash.registrationExpiring') };

  if (error) return <Shell active="/dashboard"><div className="text-red-500">{error}</div></Shell>;
  if (!stats) return <Shell active="/dashboard"><div className="text-slate-400">{t('dash.loadingDashboard')}</div></Shell>;

  const pieData = Object.entries(stats.statusBreakdown).map(([name, value]) => ({ name, value }));
  const distanceData = stats.topByDistance.map(v => ({ name: v.vehicle_number, distance: Number(v.distance_km) }));
  const statusHistoryData = stats.statusHistory.map(s => ({
    date: s.snapshot_date.slice(5), Running: s.running, Stopped: s.stopped,
  }));
  const driverPieData = Object.entries(stats.driverStatusBreakdown || {}).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  const typeData = Object.entries(stats.typeBreakdown || {}).map(([name, value]) => ({ name, value }));
  const expiryChartData = Object.entries(stats.expiryLevelCounts || {}).map(([key, counts]) => ({
    name: EXPIRY_LABELS[key] || key, green: counts.green, yellow: counts.yellow, orange: counts.orange, red: counts.red,
  }));
  const critical = key => {
    const c = stats.expiryLevelCounts?.[key];
    return c ? c.orange + c.red : 0;
  };
  const monthlyCostData = (stats.monthlyMaintenanceCost || []).map(m => ({ month: m.month.slice(5), cost: m.cost }));
  const categoryPieData = stats.categoryBreakdown || [];
  const CATEGORY_COLORS = ['#6B7A4F', '#0ea5e9', '#BC6B4E', '#ef4444', '#8b5cf6', '#7FA65C', '#f97316', '#64748b', '#ec4899'];

  return (
    <Shell active="/dashboard">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon="🚗" tone="brand" label={t('dash.totalVehicles')} value={stats.totalVehicles} sub={t('dash.allVehicles')} href="/vehicles" />
        <StatCard icon="▶" tone="emerald" label={t('dash.running')} value={stats.running} sub={`${pct(stats.running, stats.totalVehicles)}% ${t('dash.ofTotal')}`} href="/vehicles?status=Running" />
        <StatCard icon="⏸" tone="amber" label={t('dash.idle')} value={stats.idle} sub={`${pct(stats.idle, stats.totalVehicles)}% ${t('dash.ofTotal')}`} href="/vehicles?status=Idle" />
        <StatCard icon="⏹" tone="red" label={t('dash.stopped')} value={stats.stopped} sub={`${pct(stats.stopped, stats.totalVehicles)}% ${t('dash.ofTotal')}`} href="/vehicles?status=Stopped" />
        <StatCard icon={'\u{1F464}'} tone="blue" label={t('dash.totalDrivers')} value={stats.totalDrivers} sub={t('dash.activeDrivers')} />
        <StatCard icon={'\u{1F4CD}'} tone="slate" label={t('dash.totalDistance')} value={fmt(stats.totalDistance) + ' km'} sub={t('dash.thisPeriod')} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon={'\u{1F4CA}'} tone="brand" label={t('dash.totalTrips')} value={stats.totalTrips} sub={t('dash.loggedTrips')} />
        <StatCard icon={'\u{1F4A8}'} tone="blue" label={t('dash.avgSpeed')} value={stats.avgSpeed != null ? stats.avgSpeed + ' km/h' : '—'} sub={stats.avgSpeed != null ? t('dash.fromLoggedTrips') : t('dash.noTripsLoggedYet')} />
        <StatCard icon="⛽" tone="amber" label={t('dash.fuelConsumed')} value={fmt(stats.fuelConsumed) + ' L'} sub={t('dash.thisPeriod')} />
        <StatCard icon={'\u{1F4B0}'} tone="slate" label={t('dash.fuelCost')} value={'SAR ' + fmt(stats.fuelCost)} sub={t('dash.thisPeriod')} />
        <StatCard icon={'\u{1F527}'} tone="amber" label={t('dash.maintenanceDue')} value={stats.maintenanceDueCount} sub={t('dash.vehicles')} href="/maintenance-schedule" />
        <StatCard icon="⚠" tone="red" label={t('dash.activeAlerts')} value={stats.activeAlerts} sub={t('dash.unread')} href="/alerts" />
        <StatCard icon={'\u{1F6E2}'} tone="slate" label={t('dash.maintenanceCost')} value={'SAR ' + fmt(stats.maintenanceCost)} sub={t('dash.loggedServices')} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon={'\u{1F6E1}'} tone={critical('license') ? 'red' : 'emerald'} label={t('dash.licenseExpiring')} value={critical('license')} sub={t('dash.within30Days')} href="/drivers" />
        <StatCard icon={'\u{1F4C7}'} tone={critical('iqama') ? 'red' : 'emerald'} label={t('dash.iqamaExpiring')} value={critical('iqama')} sub={t('dash.within30Days')} href="/drivers" />
        <StatCard icon={'\u{1F6C2}'} tone={critical('passport') ? 'red' : 'emerald'} label={t('dash.passportExpiring')} value={critical('passport')} sub={t('dash.within30Days')} href="/drivers" />
        <StatCard icon={'\u{2764}'} tone={critical('medical') ? 'red' : 'emerald'} label={t('dash.medicalExpiring')} value={critical('medical')} sub={t('dash.within30Days')} href="/drivers" />
        <StatCard icon={'\u{1F4C4}'} tone={critical('insurance') ? 'red' : 'emerald'} label={t('dash.insuranceExpiring')} value={critical('insurance')} sub={t('dash.within30Days')} href="/vehicles" />
        <StatCard icon={'\u{1F4DD}'} tone={critical('registration') ? 'red' : 'emerald'} label={t('dash.registrationExpiring')} value={critical('registration')} sub={t('dash.within30Days')} href="/vehicles" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <StatCard icon={'\u{1F6E0}'} tone="brand" label={t('dash.maintenanceRecords')} value={stats.totalMaintenanceRecords} sub={t('dash.allTime')} href="/maintenance" />
        <StatCard icon={'\u{1F4B0}'} tone="slate" label={t('dash.totalMaintCost')} value={'SAR ' + fmt(stats.totalMaintenanceRecordsCost)} sub={t('dash.allRecords')} href="/maintenance" />
        <StatCard icon={'\u{1F4C5}'} tone="blue" label={t('dash.thisMonth')} value={'SAR ' + fmt(stats.thisMonthMaintenanceCost)} sub={t('dash.maintenanceCostLabel')} />
        <StatCard icon={'\u{1F4C8}'} tone="blue" label={t('dash.thisYear')} value={'SAR ' + fmt(stats.thisYearMaintenanceCost)} sub={t('dash.maintenanceCostLabel')} />
        <StatCard icon={'\u{23F3}'} tone="amber" label={t('dash.upcomingServices')} value={stats.upcomingServices} sub={t('dash.schedule')} href="/maintenance-schedule" />
        <StatCard icon={'\u{26A0}'} tone="red" label={t('dash.overdueServices')} value={stats.overdueServices} sub={t('dash.schedule')} href="/maintenance-schedule" />
        <StatCard icon={'\u{1F3ED}'} tone="amber" label={t('dash.inWorkshop')} value={stats.vehiclesInWorkshop} sub={t('dash.today')} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-[#E5E2DD] dark:border-white/10 bg-white dark:bg-white/[0.05] p-4 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.03)] dark:shadow-none hover:-translate-y-0.5 transition-transform duration-200">
          <h3 className="font-medium text-sm mb-3">{t('dash.vehiclesStatus')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                {pieData.map(d => <Cell key={d.name} fill={COLORS[d.name] || '#94a3b8'} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-[#E5E2DD] dark:border-white/10 bg-white dark:bg-white/[0.05] p-4 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.03)] dark:shadow-none hover:-translate-y-0.5 transition-transform duration-200">
          <h3 className="font-medium text-sm mb-3">{t('dash.realTimeVehicleStatus')}</h3>
          {statusHistoryData.length < 2 ? (
            <EmptyNote text={t('dash.buildingHistory')} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={statusHistoryData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Running" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Stopped" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E2DD] dark:border-white/10 bg-white dark:bg-white/[0.05] p-4 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.03)] dark:shadow-none hover:-translate-y-0.5 transition-transform duration-200">
          <h3 className="font-medium text-sm mb-3">{t('dash.top5Distance')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distanceData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={90} />
              <Tooltip />
              <Bar dataKey="distance" fill="#6B7A4F" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-[#E5E2DD] dark:border-white/10 bg-white dark:bg-white/[0.05] p-4 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.03)] dark:shadow-none hover:-translate-y-0.5 transition-transform duration-200">
          <h3 className="font-medium text-sm mb-3">{t('dash.driverStatus')}</h3>
          {driverPieData.length === 0 ? <EmptyNote text={t('dash.noDriversYet')} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={driverPieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {driverPieData.map(d => <Cell key={d.name} fill={DRIVER_COLORS[d.name] || '#94a3b8'} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E2DD] dark:border-white/10 bg-white dark:bg-white/[0.05] p-4 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.03)] dark:shadow-none hover:-translate-y-0.5 transition-transform duration-200">
          <h3 className="font-medium text-sm mb-3">{t('dash.fleetByType')}</h3>
          {typeData.length === 0 ? <EmptyNote text={t('dash.noVehiclesYet')} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={typeData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E2DD] dark:border-white/10 bg-white dark:bg-white/[0.05] p-4 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.03)] dark:shadow-none hover:-translate-y-0.5 transition-transform duration-200">
          <h3 className="font-medium text-sm mb-3">{t('dash.expirySummary')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={expiryChartData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="green" stackId="e" fill={LEVEL_COLORS.green} />
              <Bar dataKey="yellow" stackId="e" fill={LEVEL_COLORS.yellow} />
              <Bar dataKey="orange" stackId="e" fill={LEVEL_COLORS.orange} />
              <Bar dataKey="red" stackId="e" fill={LEVEL_COLORS.red} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-[#E5E2DD] dark:border-white/10 bg-white dark:bg-white/[0.05] p-4 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.03)] dark:shadow-none hover:-translate-y-0.5 transition-transform duration-200">
          <h3 className="font-medium text-sm mb-3">{t('dash.monthlyMaintCost')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyCostData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="cost" stroke="#6B7A4F" fill="#6B7A4F" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-[#E5E2DD] dark:border-white/10 bg-white dark:bg-white/[0.05] p-4 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.03)] dark:shadow-none hover:-translate-y-0.5 transition-transform duration-200">
          <h3 className="font-medium text-sm mb-3">{t('dash.maintByCategory')}</h3>
          {categoryPieData.length === 0 ? <EmptyNote text={t('dash.noMaintRecordsYet')} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryPieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {categoryPieData.map((d, i) => <Cell key={d.name} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-[#E5E2DD] dark:border-white/10 bg-white dark:bg-white/[0.05] p-4 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.03)] dark:shadow-none hover:-translate-y-0.5 transition-transform duration-200">
          <h3 className="font-medium text-sm mb-3">{t('dash.top5Shops')}</h3>
          {(!stats.topShops || stats.topShops.length === 0) ? <EmptyNote text={t('dash.noShopRecordsYet')} /> : (
            <ul className="space-y-2 text-sm">
              {stats.topShops.map((s, i) => (
                <li key={i} className="flex justify-between">
                  <span>{s.name}</span>
                  <span className="text-slate-500">SAR {fmt(s.cost)} · {s.count} {t('dash.jobs')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-[#E5E2DD] dark:border-white/10 bg-white dark:bg-white/[0.05] p-4 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.03)] dark:shadow-none hover:-translate-y-0.5 transition-transform duration-200 lg:col-span-2">
          <h3 className="font-medium text-sm mb-3">{t('dash.maintCostByVehicle')}</h3>
          {(!stats.costByVehicle || stats.costByVehicle.length === 0) ? <EmptyNote text={t('dash.noMaintRecordsYet')} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.costByVehicle} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={90} />
                <Tooltip />
                <Bar dataKey="cost" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#E5E2DD] dark:border-white/10 bg-white dark:bg-white/[0.05] p-4 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.03)] dark:shadow-none hover:-translate-y-0.5 transition-transform duration-200 mb-6">
        <h3 className="font-medium text-sm mb-3">{t('dash.recentMaintActivity')}</h3>
        {(!stats.recentMaintenanceActivity || stats.recentMaintenanceActivity.length === 0) ? <EmptyNote text={t('dash.noMaintRecordsYet')} /> : (
          <ul className="divide-y divide-black/5 dark:divide-white/5">
            {stats.recentMaintenanceActivity.map(r => (
              <li key={r.id}>
                <a href={'/maintenance/' + r.id} className="flex items-center justify-between gap-3 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] -mx-1 px-1 rounded-lg transition">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{r.vehicle_number}</span>
                    <span className="text-slate-400 text-xs">{r.category}</span>
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">{r.currency} {fmt(r.amount)} · {r.maintenance_date}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-[#E5E2DD] dark:border-white/10 bg-white dark:bg-white/[0.05] p-4 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.03)] dark:shadow-none hover:-translate-y-0.5 transition-transform duration-200 mb-6">
        <h3 className="font-medium text-sm mb-3">{t('dash.notificationCenter')}</h3>
        {stats.notifications.length === 0 ? <EmptyNote text={t('dash.allGood')} /> : (
          <ul className="divide-y divide-black/5 dark:divide-white/5">
            {stats.notifications.map((n, i) => (
              <li key={i}>
                <a href={n.href} className="flex items-center justify-between gap-3 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] -mx-1 px-1 rounded-lg transition">
                  <div className="flex items-center gap-2 min-w-0">
                    <span>{LEVEL_DOT[n.level]}</span>
                    <span className="font-medium truncate">{n.entityName}</span>
                    <span className="text-slate-400 text-xs">{n.category}</span>
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">{n.label}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#E5E2DD] dark:border-white/10 bg-white dark:bg-white/[0.05] p-4 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.03)] dark:shadow-none hover:-translate-y-0.5 transition-transform duration-200">
          <h3 className="font-medium text-sm mb-3">{t('dash.recentTrips')}</h3>
          {stats.recentTrips.length === 0 ? <EmptyNote text={t('dash.noTripsLoggedYet')} /> : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400 text-xs">
                <tr><th className="py-1.5">{t('dash.vehicle')}</th><th>{t('dash.driver')}</th><th>{t('dash.fromTo')}</th><th>{t('dash.distance')}</th></tr>
              </thead>
              <tbody>
                {stats.recentTrips.map(t => (
                  <tr key={t.id} className="border-t border-black/5 dark:border-white/5">
                    <td className="py-2">{t.cars?.vehicle_number}</td>
                    <td>{t.driver || '—'}</td>
                    <td>{t.from_place} → {t.to_place}</td>
                    <td>{t.distance_km ? t.distance_km + ' km' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E2DD] dark:border-white/10 bg-white dark:bg-white/[0.05] p-4 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.03)] dark:shadow-none hover:-translate-y-0.5 transition-transform duration-200">
          <h3 className="font-medium text-sm mb-3">{t('dash.recentAlerts')}</h3>
          {stats.recentAlerts.length === 0 ? <EmptyNote text={t('dash.noAlertsYet')} /> : (
            <ul className="space-y-2">
              {stats.recentAlerts.map(a => (
                <li key={a.id} className="flex items-start gap-2 text-sm">
                  <span className="text-red-500 mt-0.5">⚠</span>
                  <div>
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-slate-500">{a.body}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Shell>
  );
}

function EmptyNote({ text }) { return <div className="text-sm text-slate-400 py-6 text-center">{text}</div>; }
function pct(n, total) { return total ? Math.round((n / total) * 1000) / 10 : 0; }
function fmt(n) { return Number(n || 0).toLocaleString(); }
