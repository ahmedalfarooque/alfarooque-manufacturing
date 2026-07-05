'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import StatCard from '@/components/StatCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } from 'recharts';

const COLORS = { Running: '#10b981', Idle: '#f59e0b', Stopped: '#ef4444', Offline: '#64748b' };

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/cars/api/stats', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(new Error(d.error))))
      .then(setStats)
      .catch(e => setError(e.message));
  }, []);

  if (error) return <Shell active="/dashboard"><div className="text-red-500">{error}</div></Shell>;
  if (!stats) return <Shell active="/dashboard"><div className="text-slate-400">Loading dashboard…</div></Shell>;

  const pieData = Object.entries(stats.statusBreakdown).map(([name, value]) => ({ name, value }));
  const distanceData = stats.topByDistance.map(v => ({ name: v.vehicle_number, distance: Number(v.distance_km) }));

  return (
    <Shell active="/dashboard">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon="🚗" tone="brand" label="Total Vehicles" value={stats.totalVehicles} sub="All vehicles" />
        <StatCard icon="▶" tone="emerald" label="Running" value={stats.running} sub={`${pct(stats.running, stats.totalVehicles)}% of total`} />
        <StatCard icon="⏸" tone="amber" label="Idle" value={stats.idle} sub={`${pct(stats.idle, stats.totalVehicles)}% of total`} />
        <StatCard icon="⏹" tone="red" label="Stopped" value={stats.stopped} sub={`${pct(stats.stopped, stats.totalVehicles)}% of total`} />
        <StatCard icon="\u{1F464}" tone="blue" label="Total Drivers" value={stats.totalDrivers} sub="Active drivers" />
        <StatCard icon="\u{1F4CD}" tone="slate" label="Total Distance" value={fmt(stats.totalDistance) + ' km'} sub="This period" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon="\u{1F527}" tone="amber" label="Maintenance Due" value={stats.maintenanceDueCount} sub="Vehicles" />
        <StatCard icon="⚠" tone="red" label="Active Alerts" value={stats.activeAlerts} sub="Unread" />
        <StatCard icon="\u{1F6E2}" tone="slate" label="Maintenance Cost" value={'SAR ' + fmt(stats.maintenanceCost)} sub="Logged services" />
        <StatCard icon="⛽" tone="slate" label="Fuel Cost" value={'SAR ' + fmt(stats.fuelCost)} sub="Not yet tracked" />
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

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 lg:col-span-2">
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
