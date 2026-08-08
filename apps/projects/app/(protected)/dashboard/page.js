'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import StatCard from '@/components/StatCard';
import { useLiveData } from '@/lib/useLiveData';
import { useLanguage, trEnum } from '@/lib/i18n';
import { GlassIcon } from '@/components/GlassIcons';
import { CHART_COLORS, chartTheme } from '@/components/glass';
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

  if (!me) return <Shell active="/dashboard"><div className="text-[color:var(--tx-3)]">{t('dashboard.loading')}</div></Shell>;

  if (me.role === 'external') return <ExternalDashboard stats={myStats} error={myStatsError} t={t} />;

  if (error) return <Shell active="/dashboard"><div className="text-red-500">{error}</div></Shell>;
  if (!stats) return <Shell active="/dashboard"><div className="text-[color:var(--tx-3)]">{t('dashboard.loading')}</div></Shell>;

  /* Slice/legend labels display translated; fill colors stay keyed on the raw status. */
  const pieData = Object.entries(stats.statusBreakdown).map(([name, value]) => ({ name: trEnum(t, 'status', name), rawName: name, value }));
  // Chart data for stat cards — only where the number is already backed by
  // a real percentage or breakdown shown elsewhere on this page; never
  // fabricated for a bare point-in-time count.
  const runningPct = pct(stats.running, stats.totalProjects);
  const completedPct = pct(stats.completedCount, stats.totalProjects);
  const upcomingPct = pct(stats.upcomingCount, stats.totalProjects);
  const onHoldPct = pct(stats.onHoldCount, stats.totalProjects);

  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const ct = chartTheme(dark);

  return (
    <Shell active="/dashboard">
      {/* Total Project Value card intentionally removed — project value
          is only ever shown on a project's own View page, and only
          when it's actually set (see the brief: never show $0/SAR 0). */}

      {/* Quick actions — one-click shortcuts to the pages with a "+ New"
          button (admin-only, matching the gating on those buttons themselves). */}
      {me.role === 'admin' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 gfade-up">
          <a href="/projects" className="glass-card glass-card--pad flex items-center gap-3 hover:bg-[color:var(--pr-soft)] transition-colors duration-200">
            <span className="icon-tile icon-tile--sm shrink-0"><GlassIcon name="folder" size={20} bare /></span>
            <span className="text-sm font-medium truncate">{t('projects.addProject')}</span>
          </a>
          <a href="/customers" className="glass-card glass-card--pad flex items-center gap-3 hover:bg-[color:var(--pr-soft)] transition-colors duration-200">
            <span className="icon-tile icon-tile--sm shrink-0"><GlassIcon name="users" size={20} bare /></span>
            <span className="text-sm font-medium truncate">{t('cust.addCustomer')}</span>
          </a>
          <a href="/users" className="glass-card glass-card--pad flex items-center gap-3 hover:bg-[color:var(--pr-soft)] transition-colors duration-200">
            <span className="icon-tile icon-tile--sm shrink-0"><GlassIcon name="user" size={20} bare /></span>
            <span className="text-sm font-medium truncate">{t('users.addUser')}</span>
          </a>
        </div>
      )}

      {/* ── Hero KPI + top project metrics ── */}
      <div className="grid lg:grid-cols-4 gap-4 mb-6 gfade-up">
        <a href="/projects" className="glass-card glass-card--pad lg:col-span-2 flex flex-col sm:flex-row sm:items-center gap-5 cursor-pointer">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="icon-tile relative" aria-hidden="true">
                <span className="absolute inset-0.5 rounded-[11px]" style={{ background: 'radial-gradient(circle at 35% 25%, #06B6D438, transparent 72%)' }} />
                <GlassIcon name="folder" size={38} bare className="relative" />
              </span>
              <span className="text-[11px] uppercase tracking-wider text-[color:var(--tx-3)] font-semibold">{t('dashboard.totalProjects')}</span>
            </div>
            <div className="text-5xl font-bold tracking-tight leading-none text-[color:var(--tx)]">{stats.totalProjects}</div>
            <div className="text-xs text-[color:var(--tx-3)] mt-2">{t('dashboard.allProjects')}</div>
            <div className="flex flex-wrap gap-2 mt-4">
              {pieData.map(d => (
                <span key={d.rawName} className="gbadge inline-flex items-center gap-1.5 text-[color:var(--tx-2)] border-[color:var(--bd-2)] bg-[color:var(--bg-card)]">
                  <span className="h-2 w-2 rounded-full" style={{ background: COLORS[d.rawName] || '#94a3b8' }} />
                  {d.name} <b className="text-[color:var(--tx)]">{d.value}</b>
                </span>
              ))}
            </div>
          </div>
          <div className="relative w-[160px] h-[160px] shrink-0 self-center mx-auto sm:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={74} paddingAngle={2} stroke="none">
                  {pieData.map(d => <Cell key={d.rawName} fill={COLORS[d.rawName] || '#94a3b8'} />)}
                </Pie>
                <Tooltip contentStyle={ct.tooltip} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-2xl font-bold leading-none text-[color:var(--tx)]">{stats.completionPct}%</div>
              <div className="text-[10px] text-[color:var(--tx-3)] mt-1">{t('dashboard.overallCompletion')}</div>
            </div>
          </div>
        </a>
        <StatCard icon="flag" tone="blue" label={t('dashboard.runningProjects')} value={stats.running} sub={`${runningPct}% ${t('dashboard.ofTotal')}`} href="/projects?status=Running" ringPct={runningPct} />
        <StatCard icon="target" tone="emerald" label={t('dashboard.completedProjects')} value={stats.completedCount} sub={`${completedPct}% ${t('dashboard.ofTotal')}`} href="/projects?status=Completed" ringPct={completedPct} />
      </div>

      {/* ── Secondary project + team KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6 gfade-up">
        <StatCard icon="clock" tone="amber" label={t('dashboard.upcomingProjects')} value={stats.upcomingCount} sub={`${upcomingPct}% ${t('dashboard.ofTotal')}`} href="/projects?status=Upcoming" ringPct={upcomingPct} />
        <StatCard icon="x" tone="red" label={t('dashboard.onHoldProjects')} value={stats.onHoldCount} sub={`${onHoldPct}% ${t('dashboard.ofTotal')}`} href={'/projects?status=' + encodeURIComponent('On Hold')} ringPct={onHoldPct} />
        <StatCard icon="users" tone="brand" label={t('dashboard.teamMembers')} value={users.length} sub={t('dashboard.internalExternalUsers')} href="/users" typewriter />
        <StatCard icon="users" tone="slate" label={t('nav.customers')} value={stats.customersCount || 0} href="/customers" />
        <StatCard icon="clock" tone="amber" label={t('dashboard.prPending')} value={stats.purchaseRequests.pending} sub={t('dashboard.awaitingReview')} href="/purchase-requests?status=Pending" typewriter />
        <StatCard icon="shield" tone="blue" label={t('dashboard.prApproved')} value={stats.purchaseRequests.approved} sub={t('dashboard.approvedRequests')} href="/purchase-requests?status=Approved" />
      </div>

      {/* ── Purchase requests + daily update activity ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 gfade-up">
        <StatCard icon="bell" tone="red" label={t('dashboard.prUrgent')} value={stats.purchaseRequests.urgent} sub={t('dashboard.urgentCriticalPending')} href="/purchase-requests?status=Pending" />
        <div className="lg:col-span-2">
          <StatCard icon="receipt" tone="brand" label={t('dashboard.prAllRequests')} value={stats.purchaseRequests.recent.length ? stats.purchaseRequests.pending + stats.purchaseRequests.approved : 0} sub={t('dashboard.viewAll')} href="/purchase-requests"
            bars={{ values: [stats.purchaseRequests.pending, stats.purchaseRequests.approved, stats.purchaseRequests.urgent], colors: ['#f59e0b', '#0EA5E9', '#ef4444'] }} />
        </div>
        <StatCard icon="chart" tone="emerald" label={t('dashboard.updatesToday')} value={stats.dailyUpdates.today} sub={t('dashboard.submittedToday')} href="/projects" typewriter />
        <StatCard icon="clock" tone="slate" label={t('dashboard.updatesYesterday')} value={stats.dailyUpdates.yesterday} sub={t('dashboard.submittedYesterday')} href="/projects" />
        <StatCard icon="chart" tone="blue" label={t('dashboard.thisWeek')} value={stats.dailyUpdates.thisWeek} sub={t('dashboard.last7Days')} href="/projects" />
        <StatCard icon="bell" tone="red" label={t('dashboard.missingUpdates')} value={stats.dailyUpdates.missing} sub={t('dashboard.assignedNoUpdate')} href="/projects" />
      </div>

      {/* ── Quotation request KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 gfade-up">
        <StatCard icon="clock" tone="amber" label={t('qr.kpi.pending')} value={stats.quotationRequests.pending} href="/quotation-requests?status=pending" />
        <StatCard icon="target" tone="emerald" label={t('qr.kpi.accepted')} value={stats.quotationRequests.accepted} href="/quotation-requests?status=accepted" />
        <StatCard icon="clock" tone="amber" label={t('qr.kpi.onHold')} value={stats.quotationRequests.onHold} href="/quotation-requests?status=on_hold" />
        <StatCard icon="x" tone="red" label={t('qr.kpi.rejected')} value={stats.quotationRequests.rejected} href="/quotation-requests?status=rejected" />
      </div>

      {/* ── Trend charts ── */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6 gfade-up">
        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3 text-[color:var(--tx)]">{t('dashboard.projectsStartedMonthly')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={stats.projectsStartedMonthly}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: ct.axis }} stroke={ct.grid} />
              <YAxis tick={{ fontSize: 10, fill: ct.axis }} stroke={ct.grid} />
              <Tooltip contentStyle={ct.tooltip} />
              <Line type="monotone" dataKey="count" stroke={CHART_COLORS[0]} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3 text-[color:var(--tx)]">{t('dashboard.projectValueMonthly')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.projectValueMonthly}>
              <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: ct.axis }} stroke={ct.grid} />
              <YAxis tick={{ fontSize: 10, fill: ct.axis }} stroke={ct.grid} />
              <Tooltip contentStyle={ct.tooltip} formatter={v => '$' + fmtCompact(v)} />
              <Bar dataKey="value" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recent project lists ── */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6 gfade-up">
        <ProjectListCard title={t('dashboard.runningProjectsList')} projects={stats.runningProjects} dateKey="end_date" dateLabel={t('dashboard.end')} noneLabel={t('dashboard.noneYet')} />
        <ProjectListCard title={t('dashboard.recentlyCompleted')} projects={stats.recentlyCompleted} dateKey="end_date" dateLabel={t('dashboard.end')} noneLabel={t('dashboard.noneYet')} />
        <ProjectListCard title={t('dashboard.upcomingProjectsList')} projects={stats.upcomingProjects} dateKey="start_date" dateLabel={t('dashboard.start')} noneLabel={t('dashboard.noneYet')} />
      </div>

      {/* ── Latest purchase requests + activity feed ── */}
      <div className="grid lg:grid-cols-2 gap-4 gfade-up">
        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3 text-[color:var(--tx)]">{t('dashboard.latestPurchaseRequests')}</h3>
          {stats.purchaseRequests.recent.length === 0 ? (
            <div className="text-sm text-[color:var(--tx-3)] py-6 text-center">{t('dashboard.noPurchaseRequestsYet')}</div>
          ) : (
            <ul className="space-y-1">
              {stats.purchaseRequests.recent.map(r => (
                <li key={r.id}>
                  <button type="button" onClick={() => { window.location.href = '/projects/' + r.project_id + '?tab=purchase-requests'; }}
                    className="w-full text-start text-sm rounded-lg -mx-2 px-2 py-2 hover:bg-[color:var(--pr-soft)] transition">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate text-[color:var(--tx)]">{r.material_description}</span>
                      <span className={'px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ' + (PR_STATUS_BADGE[r.status] || '')}>{trEnum(t, 'status', r.status)}</span>
                    </div>
                    <div className="text-xs text-[color:var(--tx-3)]">{r.project_name} · {trEnum(t, 'status', r.priority)} · {formatDate(r.created_at)}</div>
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
      <h3 className="font-medium text-sm mb-3 text-[color:var(--tx)]">{t('dashboard.recentNotifications')}</h3>
      {notifications.length === 0 ? (
        <div className="text-sm text-[color:var(--tx-3)] py-6 text-center">{t('shell.noNotificationsYet')}</div>
      ) : (
        <ul className="space-y-1">
          {notifications.map(n => (
            <li key={n.id}>
              <button type="button" onClick={() => open(n)}
                className={'w-full text-start text-sm rounded-lg -mx-2 px-2 py-2 hover:bg-[color:var(--pr-soft)] transition ' + (n.is_read ? 'opacity-60' : '')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate text-[color:var(--tx)]">{n.title}</span>
                  {!n.is_read && <span className="h-2 w-2 rounded-full bg-brand-600 shrink-0" />}
                </div>
                {n.body && <div className="text-xs text-[color:var(--tx-3)] truncate">{n.body}</div>}
                <div className="text-[11px] text-[color:var(--tx-4)]">{formatDate(n.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</div>
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
  if (!stats) return <Shell active="/dashboard"><div className="text-[color:var(--tx-3)]">{t('dashboard.loading')}</div></Shell>;

  return (
    <Shell active="/dashboard">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 gfade-up">
        <StatCard icon="folder" tone="brand" label={t('dashboard.myProjects')} value={stats.totalProjects} href="/projects" />
        <StatCard icon="flag" tone="blue" label={t('dashboard.running')} value={stats.running} href="/projects" />
        <StatCard icon="target" tone="emerald" label={t('dashboard.completed')} value={stats.completed} href="/projects" />
        <StatCard icon="clock" tone="amber" label={t('dashboard.purchaseRequests')} value={stats.purchaseRequests.pending} sub={t('dashboard.awaitingDecision')} href="/projects" />
        <StatCard icon="chart" tone="slate" label={t('dashboard.dailyUpdates')} value={stats.dailyUpdates.thisWeek} sub={t('dashboard.thisWeek')} href="/projects" />
        <StatCard icon="bell" tone="red" label={t('dashboard.notifications')} value={stats.notifications.unread} sub={t('dashboard.unread')} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-6 gfade-up">
        {stats.projects.map(p => (
          <a key={p.id} href={'/projects/' + p.id} className="glass-card glass-card--pad hover:border-brand-600/40 transition">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium truncate text-[color:var(--tx)]">{p.project_name}</span>
              <span className={'px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ' + (STATUS_BADGE[p.status] || '')}>{trEnum(t, 'status', p.status)}</span>
            </div>
            <div className="text-xs text-[color:var(--tx-3)]">{p.customer_name}</div>
            <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 mt-3 overflow-hidden">
              <div className="h-full bg-brand-600" style={{ width: `${p.progress || 0}%` }} />
            </div>
          </a>
        ))}
        {stats.projects.length === 0 && <div className="text-sm text-[color:var(--tx-3)] py-6 text-center col-span-3">{t('dashboard.noProjectsAssigned')}</div>}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 gfade-up">
        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3 text-[color:var(--tx)]">{t('dashboard.myRecentPurchaseRequests')}</h3>
          {stats.purchaseRequests.recent.length === 0 ? <div className="text-sm text-[color:var(--tx-3)] py-6 text-center">{t('dashboard.noneYet')}</div> : (
            <ul className="space-y-1">
              {stats.purchaseRequests.recent.map(r => (
                <li key={r.id}>
                  <a href={'/projects/' + r.project_id + '?tab=purchase-requests'} className="block text-sm rounded-lg -mx-2 px-2 py-2 hover:bg-[color:var(--pr-soft)] transition">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate text-[color:var(--tx)]">{r.material_description}</span>
                      <span className="text-xs text-[color:var(--tx-3)] shrink-0">{trEnum(t, 'status', r.status)}</span>
                    </div>
                    <div className="text-xs text-[color:var(--tx-3)]">{r.project_name}</div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="glass-card glass-card--pad">
          <h3 className="font-medium text-sm mb-3 text-[color:var(--tx)]">{t('dashboard.myRecentDailyUpdates')}</h3>
          {stats.dailyUpdates.recent.length === 0 ? <div className="text-sm text-[color:var(--tx-3)] py-6 text-center">{t('dashboard.noneYet')}</div> : (
            <ul className="space-y-1">
              {stats.dailyUpdates.recent.map(u => (
                <li key={u.id}>
                  <a href={'/projects/' + u.project_id + '?tab=daily-updates'} className="block text-sm rounded-lg -mx-2 px-2 py-2 hover:bg-[color:var(--pr-soft)] transition">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate text-[color:var(--tx)]">{u.project_name}</span>
                      <span className="text-xs text-[color:var(--tx-3)] shrink-0">{trEnum(t, 'status', u.status)}</span>
                    </div>
                    <div className="text-xs text-[color:var(--tx-3)]">{u.update_date}</div>
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
  const { t } = useLanguage();
  return (
    <div className="glass-card glass-card--pad">
      <h3 className="font-medium text-sm mb-3 text-[color:var(--tx)]">{title}</h3>
      {projects.length === 0 ? (
        <div className="text-sm text-[color:var(--tx-3)] py-6 text-center">{noneLabel || t('dashboard.noneYet')}</div>
      ) : (
        <ul className="space-y-1">
          {projects.map(p => (
            <li key={p.id}>
              <button type="button" onClick={() => { window.location.href = '/projects/' + p.id; }}
                className="w-full text-start text-sm rounded-lg -mx-2 px-2 py-2 hover:bg-[color:var(--pr-soft)] transition">
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate text-[color:var(--tx)]">{p.project_name}</span>
                  <span className={'px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ' + (STATUS_BADGE[p.status] || '')}>{trEnum(t, 'status', p.status)}</span>
                </div>
                <div className="text-xs text-[color:var(--tx-3)]">{p.customer_name} · {dateLabel} {p[dateKey] || '—'}</div>
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
