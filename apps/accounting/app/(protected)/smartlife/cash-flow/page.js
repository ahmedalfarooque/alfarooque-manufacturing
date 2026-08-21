'use client';

/* Cash Flow Statement — deliberately PARTIAL. See
   apps/accounting/app/api/smartlife/cash-flow/route.js for exactly which
   two lines are real (Net Profit/Loss, Ending Cash) and why every other
   line shows N/A instead of a fabricated or zeroed value: this account
   snapshot has no historical time series, so period-over-period "change"
   cannot be legitimately computed yet. */

import PageHeader from '@/components/PageHeader';
import { GlassCard, GlassButton, GlassSelect } from '@/components/glass';
import { useLiveData } from '@/lib/useLiveData';

function money(value) {
  if (value == null) return 'N/A — no historical snapshot available';
  return `${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
}

/* Row rendered as a real table row (matching SmartLife's own tabular
   layout — numbered line items, bold/highlighted subtotal rows) rather
   than the previous card/flex layout. Still a single value column: a
   second "prior year" column is NOT added, since that would require a
   second full year of history we do not have yet — never fabricated to
   visually match the reference screenshot's two-column layout. */
function Row({ num, label, value, bold, negative }) {
  const na = value == null;
  return (
    <tr className={bold ? (negative ? 'bg-red-500/10 font-semibold' : 'bg-[color:var(--pr-soft)] font-semibold') : 'border-b border-[color:var(--bd)]'}>
      <td className="p-2 text-xs text-[color:var(--tx-3)] w-12">{num || ''}</td>
      <td className="p-2 text-sm text-[color:var(--tx-2)]">{label}</td>
      <td className={`p-2 text-end text-sm tabular-nums ${na ? 'italic text-[color:var(--tx-4)]' : (Number(value) < 0 ? 'text-red-400' : 'text-[color:var(--tx)]')}`}>{money(value)}</td>
    </tr>
  );
}

export default function CashFlowStatementPage() {
  const { data, error, loading, refresh } = useLiveData('/api/smartlife/cash-flow', 60000);

  return (
    <div className="space-y-4">
      <PageHeader title="Cash Flow Statement" description="Operating, investing and financing activities — from synchronized SmartLife data"
        meta={data?.lastSyncedAt ? `Snapshot as of ${new Date(data.lastSyncedAt).toLocaleString()}` : undefined}
        actions={<GlassButton variant="secondary" onClick={() => refresh?.()}>Refresh</GlassButton>} />

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">Could not load the cash flow statement.</div>}
      {loading && !data && <div className="py-12 text-center text-[color:var(--tx-3)]">Loading…</div>}

      {data && (
        <>
          {/* Same honest-disabled treatment as Trial Balance's / Income
              Statement's filter row — Fiscal Year / Branch have no real
              effect on a point-in-time account snapshot. */}
          <div className="mb-2 flex flex-wrap items-end gap-4 rounded-xl border border-[color:var(--bd)] p-3 text-sm opacity-60 cursor-not-allowed" title="Not available — SmartERP's synced account balances have no fiscal-year, branch, or period dimension yet.">
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">Fiscal Year<GlassSelect disabled value="" className="w-28"><option value="">Current snapshot</option></GlassSelect></label>
            <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">Branch / Warehouse<GlassSelect disabled value="" className="w-32"><option value="">All</option></GlassSelect></label>
            <span className="pb-1.5 text-[11px] italic text-[color:var(--tx-4)]">🔒 No historical/branch dimension synced yet</span>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-[color:var(--tx-3)]">{data.unavailableReason}</div>

          <GlassCard className="p-0 max-w-3xl overflow-hidden">
            <table className="w-full">
              <tbody>
                <tr><td colSpan={3} className="bg-[color:var(--pr-soft)] px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--tx-2)]">1. Operating Activities</td></tr>
                <Row num="1.1" label="Net profit (loss) for the year" value={data.operating.netProfitLoss} />
                <Row num="1.2" label="Depreciation of fixed assets" value={data.operating.depreciation} />
                <Row num="1.3" label="Change in inventory" value={data.operating.changeInInventory} />
                {data.operating.changeInInventoryNote && (
                  <tr><td/><td colSpan={2} className="ps-2 pb-1 text-[11px] italic text-[color:var(--tx-4)]">{data.operating.changeInInventoryNote}</td></tr>
                )}
                <Row num="1.4" label="Change in accounts receivable" value={data.operating.changeInReceivables} />
                <Row num="1.5" label="Change in accounts payable" value={data.operating.changeInPayables} />
                <Row label="Net cash flows from operating activities" bold negative={Number(data.operating.netCashFromOperating) < 0} value={data.operating.netCashFromOperating} />

                <tr><td colSpan={3} className="bg-[color:var(--pr-soft)] px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--tx-2)]">2. Investing Activities</td></tr>
                <Row num="2.1" label="Fixed assets" value={data.investing.fixedAssets} />
                <Row label="Net cash flows from investing activities" bold value={data.investing.netCashFromInvesting} />

                <tr><td colSpan={3} className="bg-[color:var(--pr-soft)] px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--tx-2)]">3. Financing Activities</td></tr>
                <Row num="3.1" label="Change in ownership rights" value={data.financing.changeInOwnership} />
                {data.financing.changeInOwnershipNote && (
                  <tr><td/><td colSpan={2} className="ps-2 pb-1 text-[11px] italic text-[color:var(--tx-4)]">{data.financing.changeInOwnershipNote}</td></tr>
                )}
                <Row num="3.2" label="Change in loans" value={data.financing.changeInLoans} />
                <Row label="Net cash flows from financing activities" bold value={data.financing.netCashFromFinancing} />

                <Row label="Net change in cash and cash equivalents" bold negative={Number(data.netChangeInCash) < 0} value={data.netChangeInCash} />
                <Row label="Cash and cash equivalents at the beginning of the year" value={data.beginningCash} />
                {data.beginningCashDate && <tr><td/><td colSpan={2} className="ps-2 pb-1 text-[11px] italic text-[color:var(--tx-4)]">Recorded on {data.beginningCashDate}</td></tr>}
                <Row label="Cash and cash equivalents at the end of the year" bold value={data.endingCash} />
              </tbody>
            </table>
          </GlassCard>
        </>
      )}
    </div>
  );
}
