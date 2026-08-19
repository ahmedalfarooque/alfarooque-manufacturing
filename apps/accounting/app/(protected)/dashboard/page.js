'use client';

/* Replaces the previous dashboard implementation, which queried acc_invoices/
   acc_bills/acc_bank_accounts/acc_journal_entries/acc_expenses — tables that
   have always had zero rows in this deployment (the local accounting ledger
   was never populated; SmartLife became the real source of truth instead).
   This version is powered entirely by /api/dashboard/summary, which reads
   the real synced SmartERP snapshot (erp_financial_source_records) plus
   AL FAROOQUE's own local Purchase Request records. No fabricated numbers. */

import { useState } from 'react';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassButton, GlassSelect } from '@/components/glass';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import PageHeader from '@/components/PageHeader';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function money(value, currency = 'SAR') {
  return `${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

const KPI_ACCENT = { success: '#10b981', danger: '#ef4444', default: 'var(--pr)' };

function Kpi({ label, value, tone }) {
  return (
    <GlassCard frosted className="p-4 relative overflow-hidden">
      <span className="absolute inset-y-0 start-0 w-[3px]" style={{ background: KPI_ACCENT[tone] || KPI_ACCENT.default }} aria-hidden="true" />
      <div className="ps-2">
        <div className="text-xs text-[color:var(--tx-3)]">{label}</div>
        <div className={`mt-1 text-xl font-bold ${tone === 'danger' ? 'text-red-500' : tone === 'success' ? 'text-emerald-500' : 'text-[color:var(--tx)]'}`}>{value}</div>
      </div>
    </GlassCard>
  );
}

export default function DashboardPage() {
  const [month, setMonth] = useState('all');
  const [year, setYear] = useState('all');
  const { data, error, loading, refresh } = useLiveData(`/api/dashboard/summary?month=${month}&year=${year}`, 60000);

  const k = data?.kpis || {};
  const pr = data?.purchaseRequests || {};
  const trend = data?.trend || [];

  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard" description="AL FAROOQUE Accounting — synchronized SmartERP data" actions={
        <div className="flex flex-wrap items-center gap-2">
          <GlassSelect value={month} onChange={e => setMonth(e.target.value)}>
            <option value="all">All months</option>
            {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </GlassSelect>
          <GlassSelect value={year} onChange={e => setYear(e.target.value)}>
            <option value="all">All years</option>
            {(data?.availableYears || []).map(y => <option key={y} value={y}>{y}</option>)}
          </GlassSelect>
          <GlassButton variant="secondary" onClick={() => refresh?.()}>Refresh</GlassButton>
        </div>} />

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">Could not load dashboard data.</div>}
      {loading && !data && <div className="py-12 text-center text-[color:var(--tx-3)]">Loading…</div>}

      {data && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi label="Sales Revenue" value={money(k.salesRevenue)} />
          <Kpi label="Actual Purchase Cost" value={money(k.purchaseActualCost)} />
          <Kpi label="Gross Profit" value={money(k.grossProfit)} tone={k.grossProfit >= 0 ? 'success' : 'danger'} />
          <Kpi label="Receivables" value={money(k.receivables)} />
          <Kpi label="Payables" value={money(k.payables)} />
          <Kpi label="Customers" value={String(k.customerCount || 0)} />
          <Kpi label="Suppliers" value={String(k.supplierCount || 0)} />
          <Kpi label="Products" value={String(k.productCount || 0)} />
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-[color:var(--tx-3)]">
          Not available yet — no real data source: Expenses, Net Profit (requires Expenses), Cash/Bank balance, Top Products (needs per-product line-item aggregation).
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase text-[color:var(--tx-3)]">Requested / planned purchasing — not actual cost, shown separately</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Purchase Requests" value={String(pr.count || 0)} />
            <Kpi label="Estimated (known amount)" value={money(pr.estimatedKnownTotal)} />
            <Kpi label="Requests without amount" value={String(pr.unknownCount || 0)} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Sales vs Purchases {year === 'all' ? '(by year)' : `(by month, ${year})`}</h3>
            {!trend.length ? <div className="py-8 text-center text-sm text-[color:var(--tx-3)]">No data for this period.</div> : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="period" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={v => money(v)} />
                  <Legend />
                  <Bar dataKey="sales" name="Sales" fill="#2563EB" />
                  <Bar dataKey="purchases" name="Purchases" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
          <GlassCard className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Profit Trend</h3>
            {!trend.length ? <div className="py-8 text-center text-sm text-[color:var(--tx-3)]">No data for this period.</div> : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="period" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={v => money(v)} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Top Customers</h3>
            {!(data.topCustomers || []).length ? <div className="text-sm text-[color:var(--tx-3)]">No data.</div> : (
              <ul className="space-y-2">{data.topCustomers.map(c => <li key={c.name} className="flex justify-between text-sm"><span className="truncate">{c.name}</span><span className="font-medium">{money(c.total)}</span></li>)}</ul>
            )}
          </GlassCard>
          <GlassCard className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Top Suppliers</h3>
            {!(data.topSuppliers || []).length ? <div className="text-sm text-[color:var(--tx-3)]">No data.</div> : (
              <ul className="space-y-2">{data.topSuppliers.map(s => <li key={s.name} className="flex justify-between text-sm"><span className="truncate">{s.name}</span><span className="font-medium">{money(s.total)}</span></li>)}</ul>
            )}
          </GlassCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Recent Sales</h3>
            {!(data.recentSales || []).length ? <div className="text-sm text-[color:var(--tx-3)]">No sales in this period.</div> : (
              <div className="space-y-2">{data.recentSales.map((s, i) => <div key={i} className="flex items-center justify-between text-sm border-b border-[color:var(--bd)] pb-2"><div><div className="font-medium">{s.reference}</div><div className="text-xs text-[color:var(--tx-3)]">{s.party} · {s.date}</div></div><span className="font-medium">{money(s.total, s.currency)}</span></div>)}</div>
            )}
          </GlassCard>
          <GlassCard className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Recent Purchases</h3>
            {!(data.recentPurchases || []).length ? <div className="text-sm text-[color:var(--tx-3)]">No purchases in this period.</div> : (
              <div className="space-y-2">{data.recentPurchases.map((s, i) => <div key={i} className="flex items-center justify-between text-sm border-b border-[color:var(--bd)] pb-2"><div><div className="font-medium">{s.reference}</div><div className="text-xs text-[color:var(--tx-3)]">{s.party} · {s.date}</div></div><span className="font-medium">{money(s.total, s.currency)}</span></div>)}</div>
            )}
          </GlassCard>
        </div>
      </>}
    </div>
  );
}
