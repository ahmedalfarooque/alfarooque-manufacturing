'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import StatusBadge from '@/components/StatusBadge';
import { GlassMetricCard, GlassQuickAction, GlassPanel, SectionHeading } from '@/components/glass';
import { useLanguage } from '@/lib/i18n';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

function pct(n, total) { return total ? Math.round((n / total) * 1000) / 10 : 0; }

export default function DashboardPage() {
  const { t, trL, formatNumber } = useLanguage();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('/api/stats', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setStats(d || {}))
      .catch(() => setStats({}));
  }, []);

  /* Real month-over-month figures — the exact monthly array that also
     feeds the chart panel below. Used for the quoted-value sparkline and
     its trend chip; no fabricated series/deltas. */
  const monthly = (stats?.monthly || []);
  const monthlyTrend = monthly.map(m => ({ label: m.month.slice(5), quoted: Number(m.quoted) || 0 }));
  let quotedDelta;
  if (monthly.length >= 2) {
    const a = Number(monthly[monthly.length - 2].quoted) || 0;
    const b = Number(monthly[monthly.length - 1].quoted) || 0;
    if (a > 0) quotedDelta = Math.round(((b - a) / a) * 1000) / 10;
  }
  const total = stats?.total || 0;
  const acceptedPct = pct(stats?.accepted || 0, total);

  return (
    <Shell active="/dashboard">
      {stats === null ? (
        <div className="text-sm text-[var(--tx-4)]">{t('dashboard.loading')}</div>
      ) : (
        <div className="space-y-7">
          {/* ── Primary KPIs ── */}
          <section>
            <SectionHeading>{t('nav.quotations')}</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
              <GlassMetricCard icon="receipt" tone="brand" href="/quotations"
                label={t('dashboard.totalQuotations')} value={formatNumber(total)} sub={t('dashboard.allTime')} />
              <GlassMetricCard icon="chart" tone="cyan" href="/reports"
                label={t('dashboard.quotedValueMonth')} value={formatNumber(stats.quotedMonth || 0, { maximumFractionDigits: 0 })}
                sub={t('dashboard.thisMonth')} deltaPct={quotedDelta}
                trend={monthlyTrend} trendKey="quoted" trendLabelKey="label" />
              <GlassMetricCard icon="target" tone="emerald" href="/quotations?status=accepted"
                label={t('dashboard.accepted')} value={formatNumber(stats.accepted || 0)}
                sub={`${acceptedPct}%`} ringPct={acceptedPct} />
              <GlassMetricCard icon="clock" tone="amber" href="/quotations?status=pending_approval"
                label={t('dashboard.pendingApproval')} value={formatNumber(stats.pending || 0)} />
            </div>
          </section>

          {/* ── Secondary analytics ── */}
          <section>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
              <GlassMetricCard icon="folder" tone="slate" href="/quotations?status=draft"
                label={t('dashboard.draft')} value={formatNumber(stats.draft || 0)} />
              <GlassMetricCard icon="flag" tone="blue" href="/quotations?status=sent"
                label={t('dashboard.sent')} value={formatNumber(stats.sent || 0)} />
              <GlassMetricCard icon="users" tone="cyan" href="/customers"
                label={t('dashboard.customers')} value={formatNumber(stats.customers || 0)} />
              <GlassMetricCard icon="box" tone="slate" href="/materials"
                label={t('dashboard.materials')} value={formatNumber(stats.materials || 0)} />
            </div>
          </section>

          {/* ── Charts + recent activity ── */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <GlassPanel title={t('dashboard.monthlyChart')} className="lg:col-span-2">
              <div style={{ width: '100%', height: 300 }} dir="ltr">
                <ResponsiveContainer>
                  <BarChart data={monthly.map(m => ({ ...m, label: m.month.slice(5) + '/' + m.month.slice(2, 4) }))} barGap={4}>
                    <defs>
                      <linearGradient id="qpQuoted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#36E2FF" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.6} />
                      </linearGradient>
                      <linearGradient id="qpAccepted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#0284C7" stopOpacity={0.5} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.12} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'currentColor' }} axisLine={false} tickLine={false} className="text-[var(--tx-4)]" />
                    <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} width={64} axisLine={false} tickLine={false} className="text-[var(--tx-4)]" tickFormatter={v => (v >= 1000 ? (v / 1000) + 'k' : v)} />
                    <Tooltip cursor={{ fill: 'rgba(37,212,255,0.06)' }} contentStyle={{ background: 'rgba(11,34,48,0.92)', border: '1px solid rgba(37,212,255,0.28)', borderRadius: 14, color: '#fff', backdropFilter: 'blur(8px)' }}
                      formatter={v => formatNumber(v, { maximumFractionDigits: 0 }) + ' ' + t('common.currencyUnit')} />
                    <Bar dataKey="quoted" name={t('dashboard.quoted')} fill="url(#qpQuoted)" radius={[6, 6, 0, 0]} maxBarSize={30} />
                    <Bar dataKey="accepted" name={t('dashboard.accepted')} fill="url(#qpAccepted)" radius={[6, 6, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassPanel>

            <GlassPanel title={t('dashboard.recentQuotations')}>
              <div className="space-y-1">
                {(stats.recent || []).length === 0 ? (
                  <div className="text-sm text-[var(--tx-4)] py-10 text-center">{t('common.noRecords')}</div>
                ) : (stats.recent || []).map(r => (
                  <a key={r.id} href={'/quotations/' + r.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[rgba(37,212,255,0.08)] transition-colors">
                    <span className="font-semibold text-sm whitespace-nowrap text-[var(--tx)]" dir="ltr">{r.quote_number}</span>
                    <span className="flex-1 min-w-0 truncate text-sm text-[var(--tx-3)]">
                      {r.customer ? trL(r.customer, 'company_name') : '—'}
                    </span>
                    <span className="text-sm font-semibold whitespace-nowrap text-[var(--tx-2)]" dir="ltr">{formatNumber(r.grand_total, { maximumFractionDigits: 0 })}</span>
                    <StatusBadge status={r.status} />
                  </a>
                ))}
              </div>
            </GlassPanel>
          </section>

          {/* ── Quick actions ── */}
          <section>
            <SectionHeading>{t('nav.reports')}</SectionHeading>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <GlassQuickAction icon="folder" tone="brand" label={t('nav.catalogue')} href="/catalogue" />
              <GlassQuickAction icon="truck" tone="cyan" label={t('nav.suppliers')} href="/suppliers" />
              <GlassQuickAction icon="user" tone="blue" label={t('nav.labour')} href="/labour" />
              <GlassQuickAction icon="wrench" tone="slate" label={t('nav.machines')} href="/machines" />
              <GlassQuickAction icon="bag" tone="amber" label={t('nav.expenses')} href="/expenses" />
              <GlassQuickAction icon="chart" tone="cyan" label={t('nav.reports')} href="/reports" />
              <GlassQuickAction icon="users" tone="brand" label={t('nav.customers')} href="/customers" />
              <GlassQuickAction icon="box" tone="slate" label={t('nav.materials')} href="/materials" />
            </div>
          </section>
        </div>
      )}
    </Shell>
  );
}
