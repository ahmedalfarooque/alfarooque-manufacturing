'use client';

/* Shared shell for the three business-critical reports with no real
   SmartERP transaction source yet (Daily Move / Receipts / Cash Receipts —
   see apps/accounting/lib/smartlifeTransactionAdapter.js for the full
   investigation trail and the exact vendor endpoint each one needs).

   One component, not three copies, so the moment SmartERP ships the
   missing endpoint the adapter starts returning real records/totals and
   this same shell renders them — no report redesign required. Columns are
   the adapter's own documented normalized field names, so the table header
   the user sees today is exactly the header the future real rows will fill. */

import PageHeader from '@/components/PageHeader';
import { GlassCard, GlassButton, GlassSelect } from '@/components/glass';
import { useLiveData } from '@/lib/useLiveData';

export default function BlockedTransactionReport({ title, description, apiPath, columns }) {
  const { data, error, loading, refresh } = useLiveData(apiPath, 60000);

  return (
    <div className="space-y-4">
      <PageHeader title={title} description={description}
        actions={<GlassButton variant="secondary" onClick={() => refresh?.()}>Refresh</GlassButton>} />

      <div className="mb-2 flex flex-wrap items-end gap-4 rounded-xl border border-[color:var(--bd)] p-3 text-sm opacity-60 cursor-not-allowed" title="Filters activate once SmartERP provides a real transaction endpoint for this report.">
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">From<input type="date" disabled className="rounded-lg border border-[color:var(--bd)] bg-transparent px-2 py-1.5 text-sm" /></label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">To<input type="date" disabled className="rounded-lg border border-[color:var(--bd)] bg-transparent px-2 py-1.5 text-sm" /></label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">Branch / Warehouse<GlassSelect disabled value="" className="w-32"><option value="">All</option></GlassSelect></label>
        <GlassButton size="sm" disabled>Export PDF</GlassButton>
        <span className="pb-1.5 text-[11px] italic text-[color:var(--tx-4)]">🔒 Activates once SmartERP publishes a real transaction endpoint</span>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">Could not reach the report endpoint.</div>}
      {loading && !data && <div className="py-12 text-center text-[color:var(--tx-3)]">Loading…</div>}

      {data && !data.available && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-[color:var(--tx-2)]">
          <span className="font-semibold uppercase tracking-wide text-amber-300">{data.statusLabel}</span>
          <p className="mt-1 text-[color:var(--tx-3)]">{data.reason}</p>
        </div>
      )}

      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--bd)] bg-[color:var(--pr-soft)]">
                {columns.map(col => (
                  <th key={col.key} className="whitespace-nowrap px-3 py-2 text-start text-[11px] font-semibold uppercase tracking-wide text-[color:var(--tx-3)]">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data?.records?.length
                ? data.records.map((row, i) => (
                    <tr key={i} className="border-b border-[color:var(--bd)]">
                      {columns.map(col => (
                        <td key={col.key} className={`whitespace-nowrap px-3 py-2 ${col.numeric ? 'text-end tabular-nums' : ''}`}>{row[col.key] ?? '—'}</td>
                      ))}
                    </tr>
                  ))
                : (
                  <tr>
                    <td colSpan={columns.length} className="px-3 py-8 text-center text-xs italic text-[color:var(--tx-4)]">
                      No rows to display — {data?.available ? 'no records for this period.' : 'this report requires the SmartERP transaction API listed above.'}
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}
