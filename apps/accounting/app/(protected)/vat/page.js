'use client';

import { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import { GlassBadge, GlassButton, GlassCard, GlassInput, GlassSelect, toast } from '@/components/glass';
import { exportReportPdf } from '@/lib/reportPdf';
import { useLiveData } from '@/lib/useLiveData';
import { useLanguage } from '@/lib/i18n';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const money = value => `${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;

export default function VatReportPage() {
  const { lang } = useLanguage();
  const [month, setMonth] = useState('all');
  const [year, setYear] = useState('all');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState('');
  const query = `/api/smartlife/vat?month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}`;
  const { data, error, loading, refresh } = useLiveData(query, 60000);
  const years = data?.availableYears || [];
  useEffect(() => { if (year !== 'all' && years.length && !years.includes(String(year))) setYear('all'); }, [year, years]);
  const rows = useMemo(() => (data?.rows || []).filter(row => {
    const needle = search.trim().toLowerCase();
    return !needle || [row.reference, row.party, row.type].some(value => String(value || '').toLowerCase().includes(needle));
  }), [data, search]);
  const summary = data?.summary || {};

  async function runReport(action) {
    setBusy(action);
    try {
      await exportReportPdf({
        title: 'VAT Report', period: data?.period?.label || 'All available dates', source: data?.source,
        lang,
        summary: [
          ['Sales', money(summary.sales)], ['Sales VAT', money(summary.salesVat)],
          ['Purchases', money(summary.purchases)], ['Purchase VAT', money(summary.purchaseVat)],
          ['Net VAT', money(summary.netVat)],
        ],
        columns: [
          { key: 'type', header: 'Type' }, { key: 'reference', header: 'Reference' }, { key: 'date', header: 'Date' },
          { key: 'party', header: 'Customer / Supplier' }, { key: 'totalText', header: 'Total' }, { key: 'vatText', header: 'VAT' },
        ],
        rows: rows.map(row => ({ ...row, totalText: money(row.total), vatText: money(row.vat) })),
        totals: [['Records', String(rows.length)], ['Net VAT', money(summary.netVat)]],
        fileName: `vat-report-${year}-${month}.pdf`, action,
      });
    } catch (e) { toast(e.message || 'Could not generate VAT report.', 'red'); }
    finally { setBusy(''); }
  }

  return <div className="space-y-4">
    <PageHeader title="Accounting / VAT Report" description="Output VAT from sales and input VAT from purchases — SmartLife read only"
      badge={<GlassBadge tone={data?.connected ? 'emerald' : 'amber'}>{data?.connected ? 'Live source' : 'Data unavailable'}</GlassBadge>}
      meta={data?.sourceCounts ? `${data.sourceCounts.sales} sales · ${data.sourceCounts.purchases} purchases in source` : null}
      actions={<GlassButton onClick={refresh} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</GlassButton>} />
    {(error || data?.connected === false) && <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300"><div className="font-semibold">{data?.permission_required ? 'Permission required' : 'VAT data source unavailable'}</div><div className="mt-1">{data?.error || error}</div></div>}
    <GlassCard className="p-4">
      <ListToolbar className="mb-4">
        <GlassInput className="min-w-56 flex-1" placeholder="Search reference, customer, or supplier…" value={search} onChange={e => setSearch(e.target.value)} />
        <GlassSelect value={month} onChange={e => setMonth(e.target.value)}><option value="all">All months</option>{MONTHS.map((name, i) => <option key={name} value={String(i + 1)}>{name}</option>)}</GlassSelect>
        <GlassSelect value={year} onChange={e => setYear(e.target.value)}><option value="all">All years</option>{years.map(value => <option key={value}>{value}</option>)}</GlassSelect>
        <GlassButton variant="secondary" onClick={() => { setSearch(''); setMonth('all'); setYear('all'); }}>Reset</GlassButton>
        <GlassButton variant="secondary" disabled={!rows.length || !!busy} onClick={() => runReport('print')}>{busy === 'print' ? 'Preparing…' : 'Print'}</GlassButton>
        <GlassButton variant="secondary" disabled={!rows.length || !!busy} onClick={() => runReport('save')}>{busy === 'save' ? 'Generating…' : 'Download PDF'}</GlassButton>
      </ListToolbar>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[['Sales',summary.sales],['Sales VAT',summary.salesVat],['Purchases',summary.purchases],['Purchase VAT',summary.purchaseVat],['Net VAT',summary.netVat]].map(([label,value]) => <div key={label} className="rounded-xl border border-[color:var(--bd)] p-3"><div className="text-xs text-[color:var(--tx-4)]">{label}</div><div className="mt-1 font-semibold">{money(value)}</div></div>)}
      </div>
      <div className="mt-4 overflow-auto">
        <table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-[color:var(--bd)]">{['Type','Reference','Date','Customer / Supplier','Total','VAT'].map(h => <th key={h} className="p-3 text-start text-xs uppercase text-[color:var(--tx-3)]">{h}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={`${row.type}-${row.id}-${index}`} className="border-b border-[color:var(--bd)]"><td className="p-3"><GlassBadge tone={row.type === 'Sale' ? 'emerald' : 'amber'}>{row.type}</GlassBadge></td><td className="p-3">{row.reference || '—'}</td><td className="p-3">{row.date || '—'}</td><td className="p-3">{row.party || '—'}</td><td className="p-3 text-end">{money(row.total)}</td><td className="p-3 text-end">{money(row.vat)}</td></tr>)}</tbody>
        </table>
      </div>
      {!loading && !rows.length && <div className="py-8 text-center text-[color:var(--tx-3)]">No VAT transactions matched this period and search.</div>}
    </GlassCard>
  </div>;
}
