'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import StatCard from '@/components/StatCard';
import { useLiveData } from '@/lib/useLiveData';
import { useLanguage } from '@/lib/i18n';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar, RadialBarChart, RadialBar } from 'recharts';

const COLORS = { Running: '#3b82f6', Completed: '#10b981', Upcoming: '#f59e0b', 'On Hold': '#ef4444' };
const STATUS_BADGE = {
  Running: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Upcoming: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'On Hold': 'bg-red-500/10 text-red-600 dark:text-red-400',
};
const PR_STATUS_BADGE = {
  Pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Approved: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  Ordered: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  Delivered: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  Completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};
const REFRESH_MS = 15000;

export default function DashboardPage() {
  const { t, formatDate } = useLanguage();
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);
  useEffect(() => {
    if (me?.role === 'external') return;
    fetch('/api/users', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setUsers(d.users || [])).catch(() => {});
  }, [me]);

  const { data: stats, error } = useLiveData(me?.role === 'external' ? null : '/api/stats', REFRESH_MS);
  const { data: myStats, error: myStatsError } = useLiveData(me?.role === 'external' ? '/api/my-stats' : null, REFRESH_MS);

  if (!me) return <Shell active="/dashboard"><div className="text-[#8C8A80]">{t('dashboard.loading')}</div></Shell>;

  if (me.role === 'external') return <ExternalDashboard stats={myStats} error={myStatsError} t={t} />;

  if (error) return <Shell active="/dashboard"><div className="text-red-500">{error}</div></Shell>;
  if (!stats) return <Shell active="/dashboard"><div className="text-[#8C8A80]">{t('dashboard.loading')}</div></Shell>;

  const pieData = Object.entries(stats.statusBreakdown).map(([name, value]) => ({ name, value }));
  // Chart data for stat cards — only where the number is already backed by
  // a real percentage or breakdown shown elsewhere on this page; never
  // fabricated for a bare point-in-time count.
  const runningPct = pct(stats.running, stats.totalProjects);
  const completedPct = pct(stats.completedCount, stats.totalProjects);
  const upcomingPct = pct(stats.upcomingCount, stats.totalProjects);
  const onHoldPct = pct(stats.onHoldCount, stats.totalProjects);

  return (
    <Shell active="/dashboard">
      {/* Total Project Value card intentionally removed — project value
          is only ever shown on a project's own View page, and only
          when it's actually set (see the brief: never show $0/SAR 0). */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="folder" tone="brand" label={t('dashboard.totalProjects')} value={stats.totalProjects} sub={t('dashboard.allProjects')} href="/projects"
          bars={{ values: [stats.running, stats.completedCount, stats.upcomingCount, stats.onHoldCount], colors: [COLORS.Running, COLORS.Completed, COLORS.Upcoming, COLORS['On Hold']] }} />
        <StatCard icon="flag" tone="blue" label={t('dashboard.runningProjects')} value={stats.running} sub={`${runningPct}% ${t('dashboard.ofTotal')}`} href="/projects?status=Running" ringPct={runningPct} />
        <StatCard icon="target" tone="emerald" label={t('dashboard.completedProjects')} value={stats.completedCount} sub={`${completedPct}% ${t('dashboard.ofTotal')}`} href="/projects?status=Completed" ringPct={completedPct} />
        <StatCard icon="clock" tone="amber" label={t('dashboard.upcomingProjects')} value={stats.upcomingCount} sub={`${upcomingPct}% ${t('dashboard.ofTotal')}`} href="/projects?status=Upcoming" ringPct={upcomingPct} />
        <StatCard icon="x" tone="red" label={t('dashboard.onHoldProjects')} value={stats.onHoldCount} sub={`${onHoldPct}% ${t('dashboard.ofTotal')}`} href={'/projects?status=' + encodeURIComponent('On Hold')} ringPct={onHoldPct} />
        <StatCard icon="users" tone="brand" label={t('dashboard.teamMembers')} value={users.length} sub={t('dashboard.internalExternalUsers')} href="/users" typewriter />
        <StatCard icon="clock" tone="amber" label={t('dashboard.prPending')} value={stats.purchaseRequests.pending} sub={t('dashboard.awaitingReview')} href="/purchase-requests?status=Pending" typewriter />
        <StatCard icon="shield" tone="blue" label={t('dashboard.prApproved')} value={stats.purchaseRequests.approved} sub={t('dashboard.approvedRequests')} href="/purchase-requests?status=Approved" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="bell" tone="red" label={t('dashboard.prUrgent')} value={stats.purchaseRequests.urgent} sub={t('dashboard.urgentCriticalPending')} href="/purchase-requests?status=Pending" />
        <StatCard icon="receipt" tone="brand" label={t('dashboard.prAllRequests')} value={stats.purchaseRequests.recent.length ? stats.purchaseRequests.pending + stats.purchaseRequests.approved : 0} sub={t('dashboard.viewAll')} href="/purchase-requests"
          bars={{ values: [stats.purchaseRequests.pending, stats.purchaseRequests.approved, stats.purchaseRequests.urgent], colors: ['#f59e0b', '#3b82f6', '#ef4444'] }} />
        <StatCard icon="chart" tone="emerald" label={t('dashboard.updatesToday')} value={stats.dailyUpdates.today} sub={t('dashboard.submittedToday')} href="/projects" typewriter />
        <StatCard icon="clock" tone="slate" label={t('dashboard.updatesYesterday')} value={stats.dailyUpdates.yesterday} sub={t('dashboard.submittedYesterday')} href="/projects" />
        <StatCard icon="chart" tone="blue" label={t('dashboard.thisWeek')} value={stats.dailyUpdates.thisWeek} sub={t('dashboard.last7Days')} href="/projects" />
        <StatCard icon="bell" tone="red" label={t('dashboard.missingUpdates')} value={stats.dailyUpdates.missing} sub={t('dashboard.assignedNoUpdate')} href="/projects" />
      </div>

      <div className="grid lg:grid-cols-4 gap-4 mb-6">
        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3">{t('dashboard.projectStatus')}</h3>
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

        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3">{t('dashboard.projectsStartedMonthly')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={stats.projectsStartedMonthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#6B7A4F" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3">{t('dashboard.projectValueMonthly')}</h3>
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

        <div className="glass-card glass-card--pad flex flex-col items-center justify-center">
          <h3 className="font-medium text-sm mb-3 self-start">{t('dashboard.completionProgress')}</h3>
          <ResponsiveContainer width="100%" height={160}>
            <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ name: 'done', value: stats.completionPct, fill: '#6B7A4F' }]} startAngle={90} endAngle={-270}>
              <RadialBar dataKey="value" cornerRadius={10} background clockWise />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="text-2xl font-semibold -mt-16">{stats.completionPct}%</div>
          <div className="text-xs text-[#6B6B63] mt-14">{t('dashboard.overallCompletion')}</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <ProjectListCard title={t('dashboard.runningProjectsList')} projects={stats.runningProjects} dateKey="end_date" dateLabel={t('dashboard.end')} noneLabel={t('dashboard.noneYet')} />
        <ProjectListCard title={t('dashboard.recentlyCompleted')} projects={stats.recentlyCompleted} dateKey="end_date" dateLabel={t('dashboard.end')} noneLabel={t('dashboard.noneYet')} />
        <ProjectListCard title={t('dashboard.upcomingProjectsList')} projects={stats.upcomingProjects} dateKey="start_date" dateLabel={t('dashboard.start')} noneLabel={t('dashboard.noneYet')} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3">{t('dashboard.latestPurchaseRequests')}</h3>
          {stats.purchaseRequests.recent.length === 0 ? (
            <div className="text-sm text-[#8C8A80] py-6 text-center">{t('dashboard.noPurchaseRequestsYet')}</div>
          ) : (
            <ul className="space-y-1">
              {stats.purchaseRequests.recent.map(r => (
                <li key={r.id}>
                  <button type="button" onClick={() => { window.location.href = '/projects/' + r.project_id + '?tab=purchase-requests'; }}
                    className="w-full text-start text-sm rounded-lg -mx-2 px-2 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{r.material_description}</span>
                      <span className={'px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ' + (PR_STATUS_BADGE[r.status] || '')}>{r.status}</span>
                    </div>
                    <div className="text-xs text-[#6B6B63]">{r.project_name} · {r.priority} · {formatDate(r.created_at)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <RecentNotificationsCard t={t} formatDate={formatDate} />
      </div>
    </Shell>
  );
}

function RecentNotificationsCard({ t, formatDate }) {
  const { data, refresh } = useLiveData('/api/notifications', REFRESH_MS);
  const notifications = (data?.notifications || []).slice(0, 6);

  async function open(n) {
    if (!n.is_read) {
      await fetch(`/api/notifications/${n.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ is_read: true }),
      }).catch(() => {});
      refresh();
    }
    if (n.link) window.location.href = n.link;
  }

  return (
    <div className="glass-card glass-card--pad">
      <h3 className="font-medium text-sm mb-3">{t('dashboard.recentNotifications')}</h3>
      {notifications.length === 0 ? (
        <div className="text-sm text-[#8C8A80] py-6 text-center">{t('shell.noNotificationsYet')}</div>
      ) : (
        <ul className="space-y-1">
          {notifications.map(n => (
            <li key={n.id}>
              <button type="button" onClick={() => open(n)}
                className={'w-full text-start text-sm rounded-lg -mx-2 px-2 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition ' + (n.is_read ? 'opacity-60' : '')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{n.title}</span>
                  {!n.is_read && <span className="h-2 w-2 rounded-full bg-brand-600 shrink-0" />}
                </div>
                {n.body && <div className="text-xs text-[#6B6B63] truncate">{n.body}</div>}
                <div className="text-[11px] text-[#8C8A80]">{formatDate(n.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExternalDashboard({ stats, error }) {
  const { t, formatDate } = useLanguage();
  if (error) return <Shell active="/dashboard"><div className="text-red-500">{error}</div></Shell>;
  if (!stats) return <Shell active="/dashboard"><div className="text-[#8C8A80]">{t('dashboard.loading')}</div></Shell>;

  return (
    <Shell active="/dashboard">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard icon="folder" tone="brand" label={t('dashboard.myProjects')} value={stats.totalProjects} href="/projects" />
        <StatCard icon="flag" tone="blue" label={t('dashboard.running')} value={stats.running} href="/projects" />
        <StatCard icon="target" tone="emerald" label={t('dashboard.completed')} value={stats.completed} href="/projects" />
        <StatCard icon="clock" tone="amber" label={t('dashboard.purchaseRequests')} value={stats.purchaseRequests.pending} sub={t('dashboard.awaitingDecision')} href="/projects" />
        <StatCard icon="chart" tone="slate" label={t('dashboard.dailyUpdates')} value={stats.dailyUpdates.thisWeek} sub={t('dashboard.thisWeek')} href="/projects" />
        <StatCard icon="bell" tone="red" label={t('dashboard.notifications')} value={stats.notifications.unread} sub={t('dashboard.unread')} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {stats.projects.map(p => (
          <a key={p.id} href={'/projects/' + p.id} className="glass-card glass-card--pad hover:border-brand-600/40 transition">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium truncate">{p.project_name}</span>
              <span className={'px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ' + (STATUS_BADGE[p.status] || '')}>{p.status}</span>
            </div>
            <div className="text-xs text-[#6B6B63]">{p.customer_name}</div>
            <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 mt-3 overflow-hidden">
              <div className="h-full bg-brand-600" style={{ width: `${p.progress || 0}%` }} />
            </div>
          </a>
        ))}
        {stats.projects.length === 0 && <div className="text-sm text-[#8C8A80] py-6 text-center col-span-3">{t('dashboard.noProjectsAssigned')}</div>}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3">{t('dashboard.myRecentPurchaseRequests')}</h3>
          {stats.purchaseRequests.recent.length === 0 ? <div className="text-sm text-[#8C8A80] py-6 text-center">{t('dashboard.noneYet')}</div> : (
            <ul className="space-y-1">
              {stats.purchaseRequests.recent.map(r => (
                <li key={r.id}>
                  <a href={'/projects/' + r.project_id + '?tab=purchase-requests'} className="block text-sm rounded-lg -mx-2 px-2 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{r.material_description}</span>
                      <span className="text-xs text-[#8C8A80] shrink-0">{r.status}</span>
                    </div>
                    <div className="text-xs text-[#6B6B63]">{r.project_name}</div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3">{t('dashboard.myRecentDailyUpdates')}</h3>
          {stats.dailyUpdates.recent.length === 0 ? <div className="text-sm text-[#8C8A80] py-6 text-center">{t('dashboard.noneYet')}</div> : (
            <ul className="space-y-1">
              {stats.dailyUpdates.recent.map(u => (
                <li key={u.id}>
                  <a href={'/projects/' + u.project_id + '?tab=daily-updates'} className="block text-sm rounded-lg -mx-2 px-2 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{u.project_name}</span>
                      <span className="text-xs text-[#8C8A80] shrink-0">{u.status}</span>
                    </div>
                    <div className="text-xs text-[#6B6B63]">{u.update_date}</div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4">
        <RecentNotificationsCard t={t} formatDate={formatDate} />
      </div>
    </Shell>
  );
}

function ProjectListCard({ title, projects, dateKey, dateLabel, noneLabel }) {
  return (
    <div className="glass-card glass-card--pad">
      <h3 className="font-medium text-sm mb-3">{title}</h3>
      {projects.length === 0 ? (
        <div className="text-sm text-[#8C8A80] py-6 text-center">{noneLabel || 'None yet.'}</div>
      ) : (
        <ul className="space-y-1">
          {projects.map(p => (
            <li key={p.id}>
              <button type="button" onClick={() => { window.location.href = '/projects/' + p.id; }}
                className="w-full text-start text-sm rounded-lg -mx-2 px-2 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition">
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate">{p.project_name}</span>
                  <span className={'px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ' + (STATUS_BADGE[p.status] || '')}>{p.status}</span>
                </div>
                <div className="text-xs text-[#6B6B63]">{p.customer_name} · {dateLabel} {p[dateKey] || '—'}</div>
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
