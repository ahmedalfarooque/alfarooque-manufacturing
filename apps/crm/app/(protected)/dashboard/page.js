'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { useLang } from '@/lib/i18n';
import { GlassCard, GlassBadge, GlassSkeleton } from '@/components/glass';
import { MetricCard, SectionCard, CRMEmptyRow, InitialAvatar, DistributionRow } from '@/components/CRMWidgets';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

/* GlassBadge's tone table only defines neutral/cyan/emerald/amber/red/violet/slate
   (see components/glass.js) — 'success'/'error'/'info' silently fell back to
   neutral, so every Won/Lost badge on this page rendered the same gray
   regardless of status. Fixed to use real tone keys. */
function statusTone(s) { return s === 'Won' ? 'emerald' : s === 'Lost' ? 'red' : 'cyan'; }
function quoteStatusTone(s) {
  if (s === 'accepted' || s === 'won') return 'emerald';
  if (s === 'rejected' || s === 'lost' || s === 'expired') return 'red';
  return 'cyan';
}
function invoiceStatusTone(s) {
  const v = String(s || '').toLowerCase();
  if (v === 'paid') return 'emerald';
  if (v === 'due' || v === 'overdue') return 'red';
  if (v === 'partial') return 'amber';
  return 'slate';
}

export default function DashboardPage() {
  const { data } = useLiveData('/api/dashboard', 30000);
  const { t } = useLang();
  const [me, setMe] = useState(null);
  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d2 => d2 && setMe(d2.user)).catch(() => {});
  }, []);
  const d = data || {};
  const stages = d.dealsByStage || [];
  const maxStageCount = Math.max(1, ...stages.map(s => s.count));
  const displayName = me && (me.full_name || me.name || me.email) || '';

  const kpis = [
    { label: 'Total Contacts', value: d.totalContacts ?? '—', icon: 'users', tone: 'cyan' },
    { label: 'New Customers (Month)', value: d.newCustomersThisMonth ?? '—', icon: 'user', tone: 'emerald' },
    { label: 'Leads', value: d.totalLeads ?? '—', icon: 'target', tone: 'violet' },
    { label: 'Open Opportunities', value: d.openDeals ?? '—', icon: 'flag', tone: 'amber' },
    { label: 'Pipeline Value', value: `SAR ${fmt(d.pipelineValue)}`, icon: 'chart', tone: 'cyan' },
    { label: 'Won Deals', value: d.wonDeals ?? '—', icon: 'gem', tone: 'emerald' },
    { label: 'Lost Deals', value: d.lostDeals ?? '—', icon: 'x', tone: 'red' },
    { label: 'Conversion Rate', value: d.conversionRate == null ? '—' : `${d.conversionRate}%`, icon: 'chart', tone: 'violet' },
    { label: 'Follow-ups Due', value: d.followUpsDue ?? '—', icon: 'clock', tone: 'amber' },
    { label: 'Activities (Month)', value: d.monthActivities ?? '—', icon: 'clock', tone: 'cyan' },
    { label: 'Outstanding Receivables', value: `SAR ${fmt(d.outstandingReceivables)}`, icon: 'receipt', tone: 'red' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--tx)]">{t('dashboard') || 'CRM Dashboard'}</h1>
        <p className="text-[color:var(--tx-3)] text-sm mt-1">
          {displayName ? `Welcome back, ${displayName} — here's what's happening with your CRM today.` : "Customer relationship overview"}
        </p>
      </div>

      {!data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <GlassCard key={i}><GlassSkeleton className="h-4 w-24 mb-3" /><GlassSkeleton className="h-7 w-16" /></GlassCard>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {kpis.map(k => <MetricCard key={k.label} {...k} />)}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {!!stages.length && (
              <SectionCard title="Deal Stage Distribution" className="lg:col-span-2">
                <div className="space-y-3">
                  {stages.map(s => (
                    <DistributionRow key={s.stage} label={s.stage} count={s.count} max={maxStageCount} />
                  ))}
                </div>
              </SectionCard>
            )}

            <SectionCard title="Integration Health" subtitle="Live status from the central integration layer" action="Manage" actionHref="/integrations" className={stages.length ? '' : 'lg:col-span-3'}>
              <div className="grid sm:grid-cols-2 gap-3">
                {(d.integrations || []).map(item => (
                  <div key={item.integration_key} className="rounded-xl border border-[color:var(--bd)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[color:var(--tx)]">{item.name}</span>
                      <GlassBadge tone={item.status === 'connected' ? 'emerald' : item.status === 'error' ? 'red' : 'amber'}>
                        {item.status.replaceAll('_', ' ')}
                      </GlassBadge>
                    </div>
                    {item.last_error && <p className="mt-2 truncate text-xs text-[#ef4444]" title={item.last_error}>{item.last_error}</p>}
                  </div>
                ))}
                {!(d.integrations || []).length && <CRMEmptyRow text="No integrations configured yet." />}
              </div>
            </SectionCard>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <SectionCard title="Recent Contacts" action="View all" actionHref="/contacts">
              {!(d.recentContacts || []).length ? (
                <CRMEmptyRow text="No contacts yet." />
              ) : (
                <div className="divide-y divide-[color:var(--bd)]">
                  {(d.recentContacts || []).map(c => (
                    <div key={c.id} className="py-2.5 flex items-center gap-3 text-sm">
                      <InitialAvatar name={c.name} />
                      <div className="flex-1 min-w-0">
                        <Link href={`/contacts/${c.id}`} className="text-[color:var(--tx)] font-medium hover:text-[color:var(--pr)] truncate block">{c.name}</Link>
                        {c.company && <span className="text-[color:var(--tx-3)] text-xs">{c.company}</span>}
                      </div>
                      <span className="text-[color:var(--tx-4)] text-xs shrink-0" dir="ltr">{c.email || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Recent Deals" action="View all" actionHref="/deals">
              {!(d.recentDeals || []).length ? (
                <CRMEmptyRow text="No deals yet." />
              ) : (
                <div className="divide-y divide-[color:var(--bd)]">
                  {(d.recentDeals || []).map(deal => (
                    <div key={deal.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                      <Link href={`/deals/${deal.id}`} className="text-[color:var(--tx)] font-medium hover:text-[color:var(--pr)] truncate">{deal.title}</Link>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[color:var(--tx-2)]" dir="ltr">SAR {fmt(deal.value)}</span>
                        <GlassBadge tone={statusTone(deal.status)}>{deal.status}</GlassBadge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Recent Quotations">
              {!(d.recentQuotations || []).length ? (
                <CRMEmptyRow text="No quotations yet." />
              ) : (
                <div className="divide-y divide-[color:var(--bd)]">
                  {(d.recentQuotations || []).map(q => (
                    <div key={q.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                      <span className="text-[color:var(--tx)] font-medium truncate" dir="ltr">{q.quote_number}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[color:var(--tx-2)]" dir="ltr">SAR {fmt(q.grand_total)}</span>
                        <GlassBadge tone={quoteStatusTone(q.status)}>{q.status}</GlassBadge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Recent Sales Invoices" subtitle="SmartLife source">
              {!(d.recentSalesInvoices || []).length ? (
                <CRMEmptyRow text="No synchronized sales invoices yet." />
              ) : (
                <div className="divide-y divide-[color:var(--bd)]">
                  {(d.recentSalesInvoices || []).map(inv => (
                    <div key={inv.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <span className="text-[color:var(--tx)] font-medium" dir="ltr">{inv.source_reference || '—'}</span>
                        {inv.party_name && <span className="text-[color:var(--tx-3)] ms-2 truncate">{inv.party_name}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[color:var(--tx-2)]" dir="ltr">SAR {fmt(inv.total_amount)}</span>
                        <GlassBadge tone={invoiceStatusTone(inv.source_status)}>{inv.source_status || '—'}</GlassBadge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}
