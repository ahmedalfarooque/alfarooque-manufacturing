'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import StatusBadge from '@/components/StatusBadge';
import StatCard from '@/components/StatCard';
import { useLanguage } from '@/lib/i18n';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

function QuickLink({ href, label }) {
  return (
    <a href={href} className="glass-card p-4 flex items-center justify-between text-sm font-medium cursor-pointer hover:bg-[#F1EEE7] dark:hover:bg-white/5 transition-colors duration-200">
      {label} <span className="text-[#8C8A80]">›</span>
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
        <div className="text-sm text-[#8C8A80]">{t('dashboard.loading')}</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard icon="chart" tone="brand" href="/quotations" label={t('dashboard.totalQuotations')} value={formatNumber(stats.total || 0)} sub={t('dashboard.allTime')}
              bars={{ values: [stats.draft || 0, stats.pending || 0, stats.sent || 0, stats.accepted || 0], colors: ['#E0A238', '#3B82F6', '#6B7A4F', '#10B981'] }} />
            <StatCard icon="folder" tone="amber" href="/quotations?status=draft" label={t('dashboard.draft')} value={formatNumber(stats.draft || 0)} ringPct={pct(stats.draft, stats.total)} />
            <StatCard icon="clock" tone="blue" href="/quotations?status=pending_approval" label={t('dashboard.pendingApproval')} value={formatNumber(stats.pending || 0)} ringPct={pct(stats.pending, stats.total)} />
            <StatCard icon="mail" tone="brand" href="/quotations?status=sent" label={t('dashboard.sent')} value={formatNumber(stats.sent || 0)} />
            <StatCard icon="shield" tone="emerald" href="/quotations?status=accepted" label={t('dashboard.accepted')} value={formatNumber(stats.accepted || 0)} ringPct={pct(stats.accepted, stats.total)} />
            <StatCard icon="bell" tone="red" href="/quotations?status=approved" label={t('dashboard.expiringSoon')} value={formatNumber(stats.expiring || 0)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard icon="receipt" tone="slate" href="/reports" label={t('dashboard.quotedValueMonth')} value={formatNumber(stats.quotedMonth || 0, { minimumFractionDigits: 2 })} sub={t('dashboard.thisMonth')}
              trend={stats.monthly} trendKey="quoted" trendLabelKey="month" />
            <StatCard icon="users" tone="blue" href="/customers" label={t('dashboard.customers')} value={formatNumber(stats.customers || 0)} />
            <StatCard icon="box" tone="slate" href="/materials" label={t('dashboard.materials')} value={formatNumber(stats.materials || 0)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            <QuickLink href="/catalogue" label={t('nav.catalogue')} />
            <QuickLink href="/suppliers" label={t('nav.suppliers')} />
            <QuickLink href="/labour" label={t('nav.labour')} />
            <QuickLink href="/machines" label={t('nav.machines')} />
            <QuickLink href="/expenses" label={t('nav.expenses')} />
            <QuickLink href="/reports" label={t('nav.reports')} />
            <QuickLink href="/users" label={t('nav.users')} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="glass-card p-4">
              <div className="font-semibold text-sm mb-3">{t('dashboard.monthlyChart')}</div>
              <div style={{ width: '100%', height: 260 }} dir="ltr">
                <ResponsiveContainer>
                  <BarChart data={(stats.monthly || []).map(m => ({ ...m, label: m.month.slice(5) + '/' + m.month.slice(2, 4) }))}>
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={v => (v >= 1000 ? (v / 1000) + 'k' : v)} />
                    <Tooltip formatter={v => formatNumber(v, { maximumFractionDigits: 0 }) + ' ' + t('common.currencyUnit')} />
                    <Legend />
                    <Bar dataKey="quoted" name={t('dashboard.quoted')} fill="#93A374" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="accepted" name={t('dashboard.accepted')} fill="#46512F" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass-card p-4">
              <div className="font-semibold text-sm mb-3">{t('dashboard.recentQuotations')}</div>
              <div className="space-y-1">
                {(stats.recent || []).length === 0 ? (
                  <div className="text-sm text-[#8C8A80] py-6 text-center">{t('common.noRecords')}</div>
                ) : (stats.recent || []).map(r => (
                  <a key={r.id} href={'/quotations/' + r.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#F1EEE7] dark:hover:bg-white/5 transition-colors">
                    <span className="font-medium text-sm whitespace-nowrap" dir="ltr">{r.quote_number}</span>
                    <span className="flex-1 min-w-0 truncate text-sm text-[#8C8A80]">
                      {r.customer ? trL(r.customer, 'company_name') : '—'}
                    </span>
                    <span className="text-sm font-medium whitespace-nowrap" dir="ltr">{formatNumber(r.grand_total, { maximumFractionDigits: 0 })}</span>
                    <StatusBadge status={r.status} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function pct(n, total) { return total ? Math.round((n / total) * 1000) / 10 : 0; }
