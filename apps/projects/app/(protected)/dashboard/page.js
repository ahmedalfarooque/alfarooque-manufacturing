'use client';

import Shell from '@/components/Shell';
import StatCard from '@/components/StatCard';
import { useLiveData } from '@/lib/useLiveData';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar, RadialBarChart, RadialBar } from 'recharts';

const COLORS = { Running: '#3b82f6', Completed: '#10b981', Upcoming: '#f59e0b', 'On Hold': '#ef4444' };
const STATUS_BADGE = {
  Running: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Upcoming: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'On Hold': 'bg-red-500/10 text-red-600 dark:text-red-400',
};
const REFRESH_MS = 15000;

export default function DashboardPage() {
  const { data: stats, error } = useLiveData('/projects/api/stats', REFRESH_MS);

  if (error) return <Shell active="/dashboard"><div className="text-red-500">{error}</div></Shell>;
  if (!stats) return <Shell active="/dashboard"><div className="text-slate-400">Loading dashboard…</div></Shell>;

  const pieData = Object.entries(stats.statusBreakdown).map(([name, value]) => ({ name, value }));

  return (
    <Shell active="/dashboard">
      {/* Total Project Value card intentionally removed — project value
          is only ever shown on a project's own View page, and only
          when it's actually set (see the brief: never show $0/SAR 0). */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard icon={'\u{1F4C1}'} tone="brand" label="Total Projects" value={stats.totalProjects} sub="All projects" href="/projects/projects" />
        <StatCard icon="▶" tone="blue" label="Running Projects" value={stats.running} sub={`${pct(stats.running, stats.totalProjects)}% of total`} href="/projects/projects?status=Running" />
        <StatCard icon="✔" tone="emerald" label="Completed Projects" value={stats.completedCount} sub={`${pct(stats.completedCount, stats.totalProjects)}% of total`} href="/projects/projects?status=Completed" />
        <StatCard icon={'\u{1F4C5}'} tone="amber" label="Upcoming Projects" value={stats.upcomingCount} sub={`${pct(stats.upcomingCount, stats.totalProjects)}% of total`} href="/projects/projects?status=Upcoming" />
        <StatCard icon="⏸" tone="red" label="On Hold Projects" value={stats.onHoldCount} sub={`${pct(stats.onHoldCount, stats.totalProjects)}% of total`} href={'/projects/projects?status=' + encodeURIComponent('On Hold')} />
      </div>

      <div className="grid lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Project Status</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                {pieData.map(d => <Cell key={d.name} fill={COLORS[d.name] || '#94a3b8'} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Projects Started (Monthly)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.projectsStartedMonthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#14a89b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Project Value (Monthly)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.projectValueMonthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => '$' + fmtCompact(v)} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 flex flex-col items-center justify-center">
          <h3 className="font-medium text-sm mb-3 self-start">Completion Progress</h3>
          <ResponsiveContainer width="100%" height={160}>
            <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ name: 'done', value: stats.completionPct, fill: '#14a89b' }]} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={10} background clockWise />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="text-2xl font-semibold -mt-16">{stats.completionPct}%</div>
          <div className="text-xs text-slate-500 mt-14">Overall Completion</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <ProjectListCard title="Running Projects" projects={stats.runningProjects} dateKey="end_date" dateLabel="End" />
        <ProjectListCard title="Recently Completed" projects={stats.recentlyCompleted} dateKey="end_date" dateLabel="End" />
        <ProjectListCard title="Upcoming Projects" projects={stats.upcomingProjects} dateKey="start_date" dateLabel="Start" />
      </div>
    </Shell>
  );
}

function ProjectListCard({ title, projects, dateKey, dateLabel }) {
  return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
      <h3 className="font-medium text-sm mb-3">{title}</h3>
      {projects.length === 0 ? (
        <div className="text-sm text-slate-400 py-6 text-center">None yet.</div>
      ) : (
        <ul className="space-y-1">
          {projects.map(p => (
            <li key={p.id}>
              <button type="button" onClick={() => { window.location.href = '/projects/projects/' + p.id; }}
                className="w-full text-left text-sm rounded-lg -mx-2 px-2 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition">
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{p.project_name}</span>
                  <span className={'px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ' + (STATUS_BADGE[p.status] || '')}>{p.status}</span>
                </div>
                <div className="text-xs text-slate-500">{p.customer_name} · {dateLabel} {p[dateKey] || '—'}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function pct(n, total) { return total ? Math.round((n / total) * 1000) / 10 : 0; }
function fmtCompact(n) {
  n = Number(n || 0);
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}
