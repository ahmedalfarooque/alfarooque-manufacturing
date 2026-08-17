'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/i18n';
import { GlassBadge, GlassSkeletonRows } from '@/components/glass';
import { SectionCard, CRMEmptyRow, MetricCard } from '@/components/CRMWidgets';

/* Attention Center — derives real, non-fabricated attention items directly
   from existing list endpoints (no new API route needed): overdue
   activities, opportunities closing soon, leads with a lapsed follow-up
   date, and outstanding receivables (via the existing dashboard aggregate,
   same source erp_financial_source_records query Dashboard already uses). */
export default function AttentionPage() {
  const { t } = useLang();
  const [activities, setActivities] = useState(null);
  const [deals, setDeals] = useState(null);
  const [leads, setLeads] = useState(null);
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/activities?pageSize=100').then(r => r.json()).catch(() => ({ activities: [] })),
      fetch('/api/deals?pageSize=100').then(r => r.json()).catch(() => ({ deals: [] })),
      fetch('/api/leads?pageSize=100').then(r => r.json()).catch(() => ({ leads: [] })),
      fetch('/api/dashboard').then(r => r.json()).catch(() => ({})),
    ]).then(([a, d, l, dash]) => {
      if (cancelled) return;
      setActivities(a.activities || []);
      setDeals(d.deals || []);
      setLeads(l.leads || []);
      setDashboard(dash || {});
    });
    return () => { cancelled = true; };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const overdueActivities = (activities || []).filter(a => a.status === 'Planned' && a.activity_date && a.activity_date < today);
  const closingSoonDeals = (deals || []).filter(d => d.status === 'Open' && d.expected_close_date && d.expected_close_date >= today && d.expected_close_date <= in7);
  const laggingLeads = (leads || []).filter(l => l.next_follow_up && l.next_follow_up < today && !['Converted', 'Lost'].includes(l.status));
  const outstandingReceivables = dashboard?.outstandingReceivables || 0;

  const loading = activities === null || deals === null || leads === null || dashboard === null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[color:var(--tx)]">{t('attention')}</h1>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Overdue Activities" value={loading ? '—' : overdueActivities.length} icon="clock" tone="red" />
        <MetricCard label="Closing Within 7 Days" value={loading ? '—' : closingSoonDeals.length} icon="target" tone="amber" />
        <MetricCard label="Lapsed Lead Follow-ups" value={loading ? '—' : laggingLeads.length} icon="flag" tone="violet" />
        <MetricCard label="Outstanding Receivables" value={loading ? '—' : `SAR ${Number(outstandingReceivables).toLocaleString()}`} icon="receipt" tone="cyan" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Overdue Activities" subtitle={loading ? '' : `${overdueActivities.length} past due`} action="View all" actionHref="/activities">
          {loading ? <GlassSkeletonRows rows={3} cols={2} /> : !overdueActivities.length ? <CRMEmptyRow text="Nothing overdue." /> : (
            <div className="space-y-1">
              {overdueActivities.slice(0, 10).map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[color:var(--tx)] truncate">{a.subject}</p>
                    <p className="text-xs text-[color:var(--tx-4)] truncate">{a.activity_type}{a.crm_contacts?.name ? ` · ${a.crm_contacts.name}` : ''}</p>
                  </div>
                  <GlassBadge tone="red" dir="ltr">{a.activity_date}</GlassBadge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Opportunities Closing Soon" subtitle={loading ? '' : `${closingSoonDeals.length} within 7 days`} action="View all" actionHref="/deals">
          {loading ? <GlassSkeletonRows rows={3} cols={2} /> : !closingSoonDeals.length ? <CRMEmptyRow text="Nothing closing soon." /> : (
            <div className="space-y-1">
              {closingSoonDeals.slice(0, 10).map(d => (
                <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center justify-between gap-3 py-2 -mx-2 px-2 rounded-lg hover:bg-[color:var(--pr-soft)]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[color:var(--tx)] truncate">{d.title}</p>
                    <p className="text-xs text-[color:var(--tx-4)] truncate">{d.stage}</p>
                  </div>
                  <GlassBadge tone="amber" dir="ltr">{d.expected_close_date}</GlassBadge>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Leads Needing Follow-up" subtitle={loading ? '' : `${laggingLeads.length} lapsed`} action="View all" actionHref="/leads">
          {loading ? <GlassSkeletonRows rows={3} cols={2} /> : !laggingLeads.length ? <CRMEmptyRow text="No lapsed follow-ups." /> : (
            <div className="space-y-1">
              {laggingLeads.slice(0, 10).map(l => (
                <div key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[color:var(--tx)] truncate">{l.name}</p>
                    <p className="text-xs text-[color:var(--tx-4)] truncate">{l.company || '—'}</p>
                  </div>
                  <GlassBadge tone="violet" dir="ltr">{l.next_follow_up}</GlassBadge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Outstanding Receivables" subtitle="From SmartLife-synchronized invoices">
          {loading ? <GlassSkeletonRows rows={2} cols={1} /> : outstandingReceivables > 0 ? (
            <p className="text-2xl font-bold text-[color:var(--tx)] tabular-nums" dir="ltr">SAR {Number(outstandingReceivables).toLocaleString()}</p>
          ) : <CRMEmptyRow text="No outstanding receivables." />}
        </SectionCard>
      </div>
    </div>
  );
}
