'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import StatusBadge from '@/components/StatusBadge';
import StatCard from '@/components/StatCard';
import { useLanguage } from '@/lib/i18n';
import { CHART_COLORS } from '@/components/glass';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

function QuickLink({ href, label }) {
  return (
    <a href={href} className="glass-card p-4 flex items-center justify-between text-sm font-medium cursor-pointer hover:bg-[color:var(--pr-soft)] transition-colors duration-200">
      {label} <span className="text-[color:var(--tx-3)]">›</span>
    </a>
  );
}

/* Genuine action shortcuts (distinct from the browse-only QuickLink row
   below) — each jumps straight to the page whose "+" button creates that
   record, one click away. No new routes/behavior: same hrefs the sidebar
   already uses. */
function QuickAction({ href, icon, label }) {
  return (
    <a href={href} className="glass-card glass-card--pad flex items-center gap-3 hover:bg-[color:var(--pr-soft)] transition-colors duration-200">
      <span className="icon-tile icon-tile--sm shrink-0"><span className="text-base leading-none">{icon}</span></span>
      <span className="text-sm font-medium truncate">{label}</span>
    </a>
  );
}

export default function DashboardPage() {
  const { t, tr, trL, formatNumber } = useLanguage();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('/api/stats', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setStats(d || {}))
      .catch(() => setStats({}));
  }, []);

  return (
    <Shell active="/dashboard">
      {stats === null ? (
        <div className="text-sm text-[color:var(--tx-3)]">{t('dashboard.loading')}</div>
      ) : (
        <div className="space-y-6">
          {/* Quick actions — one-click shortcuts to the pages that create a new record */}
          <section className="grid grid-cols-2 md:grid-cols-3 gap-3 gfade-up">
            <QuickAction href="/quotations" icon="＋" label={t('quote.new')} />
            <QuickAction href="/customers" icon="＋" label={t('common.add') + ' — ' + t('nav.customers')} />
            <QuickAction href="/materials" icon="＋" label={t('common.add') + ' — ' + t('nav.materials')} />
          </section>

          {/* Hero KPI row — promoted total quotations (col-span-2) + monthly quoted value */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 gfade-up">
            <div className="lg:col-span-2">
              <StatCard icon="chart" tone="brand" href="/quotations" label={t('dashboard.totalQuotations')} value={formatNumber(stats.total || 0)} sub={t('dashboard.allTime')}
                bars={{ values: [stats.draft || 0, stats.pending || 0, stats.sent || 0, stats.accepted || 0], colors: ['#F59E0B', '#0EA5E9', '#06B6D4', '#10B981'] }} />
            </div>
            <StatCard icon="receipt" tone="brand" href="/reports" label={t('dashboard.quotedValueMonth')} value={formatNumber(stats.quotedMonth || 0, { minimumFractionDigits: 2 })} sub={t('dashboard.thisMonth')}
              trend={stats.monthly} trendKey="quoted" trendLabelKey="month" />
          </section>

          {/* Pipeline status KPIs */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 gfade-up">
            <StatCard icon="folder" tone="amber" href="/quotations?status=draft" label={t('dashboard.draft')} value={formatNumber(stats.draft || 0)} ringPct={pct(stats.draft, stats.total)} />
            <StatCard icon="clock" tone="blue" href="/quotations?status=pending_approval" label={t('dashboard.pendingApproval')} value={formatNumber(stats.pending || 0)} ringPct={pct(stats.pending, stats.total)} />
            <StatCard icon="mail" tone="brand" href="/quotations?status=sent" label={t('dashboard.sent')} value={formatNumber(stats.sent || 0)} />
            <StatCard icon="shield" tone="emerald" href="/quotations?status=accepted" label={t('dashboard.accepted')} value={formatNumber(stats.accepted || 0)} ringPct={pct(stats.accepted, stats.total)} />
          </section>

          {/* Secondary KPIs */}
          <section className="grid grid-cols-2 md:grid-cols-3 gap-4 gfade-up">
            <StatCard icon="bell" tone="red" href="/quotations?status=approved" label={t('dashboard.expiringSoon')} value={formatNumber(stats.expiring || 0)} />
            <StatCard icon="users" tone="blue" href="/customers" label={t('dashboard.customers')} value={formatNumber(stats.customers || 0)} />
            <StatCard icon="box" tone="slate" href="/materials" label={t('dashboard.materials')} value={formatNumber(stats.materials || 0)} />
          </section>

          {/* Charts + recent activity */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 gfade-up">
            <div className="glass-card p-4 xl:col-span-2">
              <div className="font-semibold text-sm mb-3">{t('dashboard.monthlyChart')}</div>
              <div style={{ width: '100%', height: 300 }} dir="ltr">
                <ResponsiveContainer>
                  <BarChart data={(stats.monthly || []).map(m => ({ ...m, label: m.month.slice(5) + '/' + m.month.slice(2, 4) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(125,160,185,0.16)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={v => (v >= 1000 ? (v / 1000) + 'k' : v)} />
                    <Tooltip cursor={{ fill: 'rgba(6,182,212,0.08)' }} formatter={v => formatNumber(v, { maximumFractionDigits: 0 }) + ' ' + t('common.currencyUnit')} />
                    <Legend />
                    <Bar dataKey="quoted" name={t('dashboard.quoted')} fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="accepted" name={t('dashboard.accepted')} fill={CHART_COLORS[1]} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="font-semibold text-sm mb-3">{t('dashboard.recentQuotations')}</div>
              <div className="space-y-1">
                {(stats.recent || []).length === 0 ? (
                  <div className="text-sm text-[color:var(--tx-3)] py-6 text-center">{t('common.noRecords')}</div>
                ) : (stats.recent || []).map(r => (
                  <a key={r.id} href={'/quotations/' + r.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[color:var(--pr-soft)] transition-colors">
                    <span className="font-medium text-sm whitespace-nowrap" dir="ltr">{r.quote_number}</span>
                    <span className="flex-1 min-w-0 truncate text-sm text-[color:var(--tx-3)]">
                      {r.customer ? trL(r.customer, 'company_name') : '—'}
                    </span>
                    <span className="text-sm font-medium whitespace-nowrap" dir="ltr">{formatNumber(r.grand_total, { maximumFractionDigits: 0 })}</span>
                    <StatusBadge status={r.status} />
                  </a>
                ))}
              </div>
            </div>
          </section>

          {/* Quick links */}
          <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 gfade-up">
            <QuickLink href="/catalogue" label={t('nav.catalogue')} />
            <QuickLink href="/suppliers" label={t('nav.suppliers')} />
            <QuickLink href="/labour" label={t('nav.labour')} />
            <QuickLink href="/machines" label={t('nav.machines')} />
            <QuickLink href="/expenses" label={t('nav.expenses')} />
            <QuickLink href="/reports" label={t('nav.reports')} />
            <QuickLink href="/users" label={t('nav.users')} />
          </section>
        </div>
      )}
    </Shell>
  );
}

function pct(n, total) { return total ? Math.round((n / total) * 1000) / 10 : 0; }
