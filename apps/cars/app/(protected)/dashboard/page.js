'use client';

import Shell from '@/components/Shell';
import StatCard from '@/components/StatCard';
import { useLiveData } from '@/lib/useLiveData';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar, AreaChart, Area } from 'recharts';

const COLORS = { Running: '#10b981', Idle: '#f59e0b', Stopped: '#ef4444', Offline: '#64748b' };
const DRIVER_COLORS = { Active: '#10b981', 'On Leave': '#f59e0b', Inactive: '#64748b', Terminated: '#ef4444' };
const LEVEL_COLORS = { green: '#10b981', yellow: '#eab308', orange: '#f97316', red: '#ef4444' };
const LEVEL_DOT = { green: '🟢', yellow: '🟡', orange: '🟠', red: '🔴' };
const REFRESH_MS = 15000; // auto-refresh every 15s, matching the brief's 10-15s live-update requirement
const EXPIRY_LABELS = { license: 'License', iqama: 'Iqama', passport: 'Passport', medical: 'Medical', insurance: 'Insurance', registration: 'Registration' };

export default function DashboardPage() {
  const { data: stats, error } = useLiveData('/api/stats', REFRESH_MS);

  if (error) return <Shell active="/dashboard"><div className="text-red-500">{error}</div></Shell>;
  if (!stats) return <Shell active="/dashboard"><div className="text-slate-400">Loading dashboard…</div></Shell>;

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
  const CATEGORY_COLORS = ['#14a89b', '#0ea5e9', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981', '#f97316', '#64748b', '#ec4899'];

  return (
    <Shell active="/dashboard">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon="🚗" tone="brand" label="Total Vehicles" value={stats.totalVehicles} sub="All vehicles" href="/vehicles" />
        <StatCard icon="▶" tone="emerald" label="Running" value={stats.running} sub={`${pct(stats.running, stats.totalVehicles)}% of total`} href="/vehicles?status=Running" />
        <StatCard icon="⏸" tone="amber" label="Idle" value={stats.idle} sub={`${pct(stats.idle, stats.totalVehicles)}% of total`} href="/vehicles?status=Idle" />
        <StatCard icon="⏹" tone="red" label="Stopped" value={stats.stopped} sub={`${pct(stats.stopped, stats.totalVehicles)}% of total`} href="/vehicles?status=Stopped" />
        <StatCard icon={'\u{1F464}'} tone="blue" label="Total Drivers" value={stats.totalDrivers} sub="Active drivers" />
        <StatCard icon={'\u{1F4CD}'} tone="slate" label="Total Distance" value={fmt(stats.totalDistance) + ' km'} sub="This period" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon={'\u{1F4CA}'} tone="brand" label="Total Trips" value={stats.totalTrips} sub="Logged trips" />
        <StatCard icon={'\u{1F4A8}'} tone="blue" label="Avg Speed" value={stats.avgSpeed != null ? stats.avgSpeed + ' km/h' : '—'} sub={stats.avgSpeed != null ? 'From logged trips' : 'No trips logged yet'} />
        <StatCard icon="⛽" tone="amber" label="Fuel Consumed" value={fmt(stats.fuelConsumed) + ' L'} sub="This period" />
        <StatCard icon={'\u{1F4B0}'} tone="slate" label="Fuel Cost" value={'SAR ' + fmt(stats.fuelCost)} sub="This period" />
        <StatCard icon={'\u{1F527}'} tone="amber" label="Maintenance Due" value={stats.maintenanceDueCount} sub="Vehicles" href="/maintenance-schedule" />
        <StatCard icon="⚠" tone="red" label="Active Alerts" value={stats.activeAlerts} sub="Unread" href="/alerts" />
        <StatCard icon={'\u{1F6E2}'} tone="slate" label="Maintenance Cost" value={'SAR ' + fmt(stats.maintenanceCost)} sub="Logged services" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon={'\u{1F6E1}'} tone={critical('license') ? 'red' : 'emerald'} label="License Expiring" value={critical('license')} sub="≤30 days" href="/drivers" />
        <StatCard icon={'\u{1F4C7}'} tone={critical('iqama') ? 'red' : 'emerald'} label="Iqama Expiring" value={critical('iqama')} sub="≤30 days" href="/drivers" />
        <StatCard icon={'\u{1F6C2}'} tone={critical('passport') ? 'red' : 'emerald'} label="Passport Expiring" value={critical('passport')} sub="≤30 days" href="/drivers" />
        <StatCard icon={'\u{2764}'} tone={critical('medical') ? 'red' : 'emerald'} label="Medical Expiring" value={critical('medical')} sub="≤30 days" href="/drivers" />
        <StatCard icon={'\u{1F4C4}'} tone={critical('insurance') ? 'red' : 'emerald'} label="Insurance Expiring" value={critical('insurance')} sub="≤30 days" href="/vehicles" />
        <StatCard icon={'\u{1F4DD}'} tone={critical('registration') ? 'red' : 'emerald'} label="Registration Expiring" value={critical('registration')} sub="≤30 days" href="/vehicles" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <StatCard icon={'\u{1F6E0}'} tone="brand" label="Maintenance Records" value={stats.totalMaintenanceRecords} sub="All time" href="/maintenance" />
        <StatCard icon={'\u{1F4B0}'} tone="slate" label="Total Maint. Cost" value={'SAR ' + fmt(stats.totalMaintenanceRecordsCost)} sub="All records" href="/maintenance" />
        <StatCard icon={'\u{1F4C5}'} tone="blue" label="This Month" value={'SAR ' + fmt(stats.thisMonthMaintenanceCost)} sub="Maintenance cost" />
        <StatCard icon={'\u{1F4C8}'} tone="blue" label="This Year" value={'SAR ' + fmt(stats.thisYearMaintenanceCost)} sub="Maintenance cost" />
        <StatCard icon={'\u{23F3}'} tone="amber" label="Upcoming Services" value={stats.upcomingServices} sub="Schedule" href="/maintenance-schedule" />
        <StatCard icon={'\u{26A0}'} tone="red" label="Overdue Services" value={stats.overdueServices} sub="Schedule" href="/maintenance-schedule" />
        <StatCard icon={'\u{1F3ED}'} tone="amber" label="In Workshop" value={stats.vehiclesInWorkshop} sub="Today" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Vehicles Status</h3>
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

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Real Time Vehicle Status</h3>
          {statusHistoryData.length < 2 ? (
            <EmptyNote text="Building history — check back after a few more days of dashboard views." />
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

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Top 5 Vehicles by Distance</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={distanceData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={90} />
              <Tooltip />
              <Bar dataKey="distance" fill="#14a89b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Driver Status</h3>
          {driverPieData.length === 0 ? <EmptyNote text="No drivers added yet." /> : (
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

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Fleet by Type</h3>
          {typeData.length === 0 ? <EmptyNote text="No vehicles added yet." /> : (
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

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Expiry Summary</h3>
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
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Monthly Maintenance Cost</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyCostData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="cost" stroke="#14a89b" fill="#14a89b" fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Maintenance by Category</h3>
          {categoryPieData.length === 0 ? <EmptyNote text="No maintenance records yet." /> : (
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
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Top 5 Maintenance Shops</h3>
          {(!stats.topShops || stats.topShops.length === 0) ? <EmptyNote text="No shop-linked records yet." /> : (
            <ul className="space-y-2 text-sm">
              {stats.topShops.map((s, i) => (
                <li key={i} className="flex justify-between">
                  <span>{s.name}</span>
                  <span className="text-slate-500">SAR {fmt(s.cost)} · {s.count} jobs</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 lg:col-span-2">
          <h3 className="font-medium text-sm mb-3">Maintenance Cost by Vehicle</h3>
          {(!stats.costByVehicle || stats.costByVehicle.length === 0) ? <EmptyNote text="No maintenance records yet." /> : (
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

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-6">
        <h3 className="font-medium text-sm mb-3">Recent Maintenance Activity</h3>
        {(!stats.recentMaintenanceActivity || stats.recentMaintenanceActivity.length === 0) ? <EmptyNote text="No maintenance records yet." /> : (
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

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-6">
        <h3 className="font-medium text-sm mb-3">Notification Center</h3>
        {stats.notifications.length === 0 ? <EmptyNote text="Nothing urgent — all licenses, iqamas, insurance, and registrations are in good standing." /> : (
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
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Recent Trips</h3>
          {stats.recentTrips.length === 0 ? <EmptyNote text="No trips logged yet." /> : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-400 text-xs">
                <tr><th className="py-1.5">Vehicle</th><th>Driver</th><th>From → To</th><th>Distance</th></tr>
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

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Recent Alerts</h3>
          {stats.recentAlerts.length === 0 ? <EmptyNote text="No alerts yet." /> : (
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
