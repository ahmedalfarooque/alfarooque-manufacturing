'use client';

/* Financial Position (Balance Sheet) — see
   apps/accounting/app/api/smartlife/financial-position/route.js for the
   account-root mapping, the equity/net-profit reconciliation, and why the
   tiny "Difference" line is shown honestly instead of hidden. Point-in-time
   snapshot like Trial Balance/Account Balances — no functional fiscal-year
   selector for the same reason as Income Statement (no date dimension on
   the synced balances). */

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

export default function FinancialPositionPage() {
  const { data, error, loading, refresh } = useLiveData('/api/smartlife/financial-position', 60000);
  const s = data?.sections;

  return (
    <div className="space-y-4">
      <PageHeader title="Financial Position" description="Assets, liabilities and equity — from synchronized SmartLife account balances"
        meta={data?.lastSyncedAt ? `Snapshot as of ${new Date(data.lastSyncedAt).toLocaleString()}` : undefined}
        actions={<GlassButton variant="secondary" onClick={() => refresh?.()}>Refresh</GlassButton>} />

      <div className="mb-2 flex flex-wrap items-end gap-4 rounded-xl border border-[color:var(--bd)] p-3 text-sm opacity-60 cursor-not-allowed" title="Not available — SmartERP's synced account balances have no fiscal-year, branch, or period dimension yet.">
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">Fiscal Year<GlassSelect disabled value="" className="w-28"><option value="">Current snapshot</option></GlassSelect></label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">Branch / Warehouse<GlassSelect disabled value="" className="w-32"><option value="">All</option></GlassSelect></label>
        <span className="pb-1.5 text-[11px] italic text-[color:var(--tx-4)]">🔒 No historical/branch dimension synced yet</span>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">Could not load the financial position.</div>}
      {loading && !data && <div className="py-12 text-center text-[color:var(--tx-3)]">Loading…</div>}

      {data && !data.complete && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-[color:var(--tx-3)]">
          One or more of the underlying account balances (101/102/103/201/202/203) is not present in the current synced snapshot — figures below reflect only what is currently available.
        </div>
      )}

      {s && (
        <GlassCard className="p-5 max-w-2xl">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--tx-3)] mb-2">Assets</h3>
          <Row num="1.1" label="Fixed Assets" indent value={money(s.assets.lines.fixedAssets.balance)} />
          <Row num="1.2" label="Current Assets" indent value={money(s.assets.lines.currentAssets.balance)} />
          <Row num="1.3" label="Cash & Equivalents" indent value={money(s.assets.lines.cash.balance)} />
          <Row label="Total Assets" bold value={money(s.assets.totalAssets)} />

          <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--tx-3)] mt-5 mb-2">Liabilities</h3>
          <Row num="2.1" label="Non-current Liabilities" indent value={money(s.liabilities.lines.nonCurrentLiabilities.balance)} />
          <Row num="2.2" label="Current Liabilities" indent value={money(s.liabilities.lines.currentLiabilities.balance)} />
          <Row label="Total Liabilities" bold value={money(s.liabilities.totalLiabilities)} />

          <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--tx-3)] mt-5 mb-2">Equity</h3>
          <Row num="3.1" label="Capital & Reserves" indent value={money(s.equity.lines.equity.balance)} />
          <Row num="3.2" label={s.equity.lines.netProfitLoss < 0 ? 'Net Loss for the Year' : 'Net Profit for the Year'} indent value={money(s.equity.lines.netProfitLoss)} />
          <Row label="Total Equity" bold value={money(s.equity.totalEquity)} />

          <Row label="Total Liabilities & Equity" bold value={money(s.totalLiabilitiesAndEquity)} />
          <Row label="Difference (Assets − Liabilities & Equity)" value={money(s.difference)} />
        </GlassCard>
      )}
    </div>
  );
}
