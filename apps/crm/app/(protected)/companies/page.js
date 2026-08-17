'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { useLang } from '@/lib/i18n';
import { GlassCard, GlassInput, GlassTh, GlassTd, GlassSkeletonRows, GlassBadge, GlassButton, GlassPagination, toast } from '@/components/glass';
import { MetricCard, CRMEmptyState } from '@/components/CRMWidgets';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

export default function CompaniesPage() {
  const { t, lang } = useLang();
  const [search, setSearch] = useState('');
  const [reportBusy, setReportBusy] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const { data } = useLiveData(`/api/companies?${params}`, 20000);
  const companies = data?.companies || [];
  /* No date field exists on this virtual grouping (see /api/companies), so
     only pagination is standardized here — company name is already the
     natural, stable sort (alphabetical, applied server-side). */
  const pagedCompanies = companies.slice((page - 1) * pageSize, page * pageSize);

  const totalContacts = companies.reduce((s, c) => s + c.contactCount, 0);
  const totalOpenDeals = companies.reduce((s, c) => s + c.openDeals, 0);
  const totalValue = companies.reduce((s, c) => s + c.totalDealValue, 0);

  async function runReport(action) {
    setReportBusy(action);
    try {
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({
        title: 'Companies',
        columns: [
          { key: 'company', header: 'Company' }, { key: 'contacts', header: 'Contacts' },
          { key: 'openDeals', header: 'Open Opportunities' }, { key: 'value', header: 'Total Deal Value' },
        ],
        rows: companies.map(c => ({
          company: c.company || '—', contacts: c.contactCount, openDeals: c.openDeals,
          value: c.totalDealValue ? `SAR ${fmt(c.totalDealValue)}` : '—',
        })),
        lang, fileName: 'companies-report.pdf', action,
      });
    } catch (e) { toast('Report generation failed', 'error'); }
    finally { setReportBusy(''); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[color:var(--tx)]">{t('companies')}</h1>
        <div className="flex items-center gap-2">
          <GlassButton variant="secondary" onClick={() => runReport('print')} disabled={!companies.length || !!reportBusy}>{reportBusy === 'print' ? '…' : t('print')}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runReport('save')} disabled={!companies.length || !!reportBusy}>⇩ {reportBusy === 'save' ? '…' : t('downloadPdf')}</GlassButton>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Companies" value={data ? companies.length : '—'} icon="box" tone="cyan" />
        <MetricCard label="Total Contacts" value={data ? totalContacts : '—'} icon="users" tone="violet" />
        <MetricCard label="Open Opportunities" value={data ? totalOpenDeals : '—'} icon="target" tone="amber" />
        <MetricCard label="Total Deal Value" value={data ? `SAR ${fmt(totalValue)}` : '—'} icon="gem" tone="emerald" />
      </div>

      <GlassCard>
        <div className="flex gap-3 mb-4">
          <GlassInput placeholder="Search company…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1" />
        </div>

        {!data ? (
          <GlassSkeletonRows rows={6} cols={4} />
        ) : !companies.length ? (
          <CRMEmptyState title="No companies yet" text="Companies appear here once contacts have a company name set." />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[color:var(--bd)]">
                  <GlassTh>Company</GlassTh>
                  <GlassTh>Contacts</GlassTh>
                  <GlassTh>Open Opportunities</GlassTh>
                  <GlassTh>Total Deal Value</GlassTh>
                </tr>
              </thead>
              <tbody>
                {pagedCompanies.map(c => (
                  <tr key={c.company} className="border-b border-[color:var(--bd)] hover:bg-[color:var(--pr-soft)]">
                    <GlassTd className="font-medium text-[color:var(--tx)]">
                      <Link href={`/companies/${encodeURIComponent(c.company)}`} className="hover:text-[color:var(--pr)]">{c.company}</Link>
                    </GlassTd>
                    <GlassTd className="text-[color:var(--tx-3)]">{c.contactCount}</GlassTd>
                    <GlassTd>{c.openDeals > 0 ? <GlassBadge tone="amber">{c.openDeals}</GlassBadge> : <span className="text-[color:var(--tx-4)]">0</span>}</GlassTd>
                    <GlassTd className="text-[color:var(--tx-3)]" dir="ltr">{c.totalDealValue ? `SAR ${fmt(c.totalDealValue)}` : '—'}</GlassTd>
                  </tr>
                ))}
              </tbody>
            </table>
            <GlassPagination page={page} pageSize={pageSize} total={companies.length} onPage={setPage}
              onPageSize={v => { setPageSize(v); setPage(1); }} />
          </>
        )}
      </GlassCard>
    </div>
  );
}
