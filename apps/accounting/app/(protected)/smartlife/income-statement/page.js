'use client';

/* Income Statement — reconstructed from real synced SmartLife account
   balances (see apps/accounting/app/api/smartlife/income-statement/route.js
   for the account-root mapping and full calculation trace). This is a
   point-in-time snapshot (erp_smartlife_account_balances has no year/branch
   dimension), so unlike SmartLife's own web report there is no functional
   fiscal-year/branch selector here — showing one that couldn't actually
   change the query would violate this app's "no decorative filters" rule.
   Layout follows the SmartLife Income Statement screenshot's section
   structure (Sales / Sales Cost / Total Profit / Expenses / Income /
   Final Net Profit-Loss). */

import PageHeader from '@/components/PageHeader';
import { GlassCard, GlassButton, GlassSelect } from '@/components/glass';
import { useLiveData } from '@/lib/useLiveData';

function money(value) {
  if (value == null) return 'N/A';
  return `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}

function Row({ num, label, value, bold, indent }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-1.5 ${indent ? 'ps-4' : ''} ${bold ? 'font-semibold border-t border-[color:var(--bd)] mt-1 pt-2' : ''}`}>
      <div className="text-sm text-[color:var(--tx-2)]">{num ? `${num} ` : ''}{label}</div>
      <div className="text-sm tabular-nums text-[color:var(--tx)]">{value}</div>
    </div>
  );
}

export default function IncomeStatementPage() {
  const { data, error, loading, refresh } = useLiveData('/api/smartlife/income-statement', 60000);
  const s = data?.sections;

  return (
    <div className="space-y-4">
      <PageHeader title="Income Statement" description="Sales, cost of sales, expenses and income — from synchronized SmartLife account balances"
        meta={data?.lastSyncedAt ? `Snapshot as of ${new Date(data.lastSyncedAt).toLocaleString()}` : undefined}
        actions={<GlassButton variant="secondary" onClick={() => refresh?.()}>Refresh</GlassButton>} />

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">Could not load the income statement.</div>}
      {loading && !data && <div className="py-12 text-center text-[color:var(--tx-3)]">Loading…</div>}

      {/* Same honest-disabled treatment as Trial Balance's second filter row
          (see .../smartlife/[resource]/page.js): erp_smartlife_account_balances
          has no year/branch/snapshot-date column (confirmed via schema), so
          Fiscal Year / Previous-Year Comparison / Branch cannot be functional
          here — a working-looking control with no real effect would be
          dishonest, so it stays visibly disabled instead. */}
      <div className="mb-2 flex flex-wrap items-end gap-4 rounded-xl border border-[color:var(--bd)] p-3 text-sm opacity-60 cursor-not-allowed" title="Not available — SmartERP's synced account balances have no fiscal-year, branch, or period dimension yet.">
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">Fiscal Year<GlassSelect disabled value="" className="w-28"><option value="">Current snapshot</option></GlassSelect></label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">Previous Year Comparison<GlassSelect disabled value="" className="w-36"><option value="">Not available</option></GlassSelect></label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">Branch / Warehouse<GlassSelect disabled value="" className="w-32"><option value="">All</option></GlassSelect></label>
        <span className="pb-1.5 text-[11px] italic text-[color:var(--tx-4)]">🔒 No historical/branch dimension synced yet</span>
      </div>

      {data && !data.complete && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-[color:var(--tx-3)]">
          One or more of the underlying account balances (401/402/403/301/302/303/501/502/503/601/602) is not present in the current synced snapshot — figures below reflect only what is currently available.
        </div>
      )}

      {s && (
        <GlassCard className="p-5 max-w-2xl">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--tx-3)] mb-2">Sales</h3>
          <Row num="1.1" label="Sales" indent value={money(s.sales.lines.sales.balance)} />
          <Row num="1.2" label="Sales Returns" indent value={money(s.sales.lines.salesReturns.balance)} />
          <Row num="1.3" label="Sales Discount" indent value={money(s.sales.lines.salesDiscount.balance)} />
          <Row label="Net Sales" bold value={money(s.sales.netSales)} />

          <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--tx-3)] mt-5 mb-2">Sales Cost</h3>
          <Row num="2.1" label="Sales Cost" indent value={money(s.salesCost.lines.purchases.balance)} />
          <Row num="2.2" label="Purchase Returns" indent value={money(s.salesCost.lines.purchaseReturns.balance)} />
          <Row num="2.3" label="Purchase Discount" indent value={money(s.salesCost.lines.purchaseDiscount.balance)} />
          <Row label="Sales Cost" bold value={money(s.salesCost.salesCost)} />
          <Row label="Total Profit" bold value={money(s.totalProfit)} />

          <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--tx-3)] mt-5 mb-2">Expenses</h3>
          <Row num="3.1" label="G&A Expenses" indent value={money(s.expenses.lines.ga.balance)} />
          <Row num="3.2" label="Selling & Marketing Expenses" indent value={money(s.expenses.lines.selling.balance)} />
          <Row num="3.3" label="Other Miscellaneous Expenses" indent value={money(s.expenses.lines.otherExp.balance)} />
          <Row label="Total Expenses" bold value={money(s.expenses.totalExpenses)} />

          <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--tx-3)] mt-5 mb-2">Income</h3>
          <Row num="4.1" label="Operating Income" indent value={money(s.income.lines.opIncome.balance)} />
          <Row num="4.2" label="Other Income" indent value={money(s.income.lines.otherInc.balance)} />
          <Row label="Total Income" bold value={money(s.income.totalIncome)} />

          <Row label={s.netProfitLoss < 0 ? 'Net Loss' : 'Net Profit'} bold value={money(Math.abs(s.netProfitLoss))} />
        </GlassCard>
      )}
    </div>
  );
}
