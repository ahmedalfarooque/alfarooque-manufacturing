'use client';

import { useLang } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { GlassSkeletonRows } from '@/components/glass';
import { MetricCard, SectionCard, DistributionRow, CRMEmptyRow } from '@/components/CRMWidgets';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 0 }); }

export default function AnalyticsPage() {
  const { t } = useLang();
  const { data } = useLiveData('/api/analytics', 30000);

  const leadFunnel = data?.leadFunnel || [];
  const dealsByStage = data?.dealsByStage || [];
  const topCompanies = data?.topCompanies || [];
  const contactsByType = data?.contactsByType || [];
  const monthlyTrend = data?.monthlyTrend || [];

  const maxLeadFunnel = Math.max(1, ...leadFunnel.map(r => r.count));
  const maxDealStage = Math.max(1, ...dealsByStage.map(r => r.count));
  const maxCompanyValue = Math.max(1, ...topCompanies.map(r => r.value));
  const maxContactType = Math.max(1, ...contactsByType.map(r => r.count));
  const maxMonthly = Math.max(1, ...monthlyTrend.flatMap(r => [r.contacts, r.leads, r.deals]));

  const totalLeads = leadFunnel.reduce((s, r) => s + r.count, 0);
  const totalOpenDealValue = dealsByStage.filter(r => !r.stage.startsWith('Closed')).reduce((s, r) => s + r.value, 0);
  const totalContacts = contactsByType.reduce((s, r) => s + r.count, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[color:var(--tx)]">{t('analytics')}</h1>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Total Leads" value={data ? totalLeads : '—'} icon="flag" tone="cyan" />
        <MetricCard label="Open Pipeline Value" value={data ? `SAR ${fmt(totalOpenDealValue)}` : '—'} icon="target" tone="amber" />
        <MetricCard label="Total Contacts" value={data ? totalContacts : '—'} icon="users" tone="violet" />
        <MetricCard label="Companies Tracked" value={data ? topCompanies.length : '—'} icon="box" tone="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Lead Funnel" subtitle="By status">
          {!data ? <GlassSkeletonRows rows={4} cols={2} /> : !leadFunnel.length ? <CRMEmptyRow text="No leads yet." /> : (
            <div className="space-y-2.5">
              {leadFunnel.map(r => <DistributionRow key={r.status} label={r.status} count={r.count} max={maxLeadFunnel} tone="cyan" />)}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Opportunities by Stage" subtitle="Count per stage">
          {!data ? <GlassSkeletonRows rows={4} cols={2} /> : !dealsByStage.some(r => r.count) ? <CRMEmptyRow text="No opportunities yet." /> : (
            <div className="space-y-2.5">
              {dealsByStage.map(r => <DistributionRow key={r.stage} label={r.stage} count={r.count} max={maxDealStage} tone="violet" />)}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Top 5 Companies" subtitle="By total deal value (SAR)">
          {!data ? <GlassSkeletonRows rows={4} cols={2} /> : !topCompanies.length ? <CRMEmptyRow text="No deal-linked companies yet." /> : (
            <div className="space-y-2.5">
              {topCompanies.map(r => <DistributionRow key={r.company} label={r.company} count={r.value} max={maxCompanyValue} tone="emerald" />)}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Contacts by Type" subtitle="Distribution">
          {!data ? <GlassSkeletonRows rows={4} cols={2} /> : !contactsByType.length ? <CRMEmptyRow text="No contacts yet." /> : (
            <div className="space-y-2.5">
              {contactsByType.map(r => <DistributionRow key={r.type} label={r.type} count={r.count} max={maxContactType} tone="amber" />)}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Monthly Trend" subtitle="New records, last 6 months" className="lg:col-span-2">
          {!data ? <GlassSkeletonRows rows={6} cols={4} /> : (
            <div className="space-y-4">
              {monthlyTrend.map(r => (
                <div key={r.month} className="space-y-1.5">
                  <p className="text-xs font-medium text-[color:var(--tx-3)]">{r.month}</p>
                  <DistributionRow label="Contacts" count={r.contacts} max={maxMonthly} tone="violet" />
                  <DistributionRow label="Leads" count={r.leads} max={maxMonthly} tone="cyan" />
                  <DistributionRow label="Opportunities" count={r.deals} max={maxMonthly} tone="amber" />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
