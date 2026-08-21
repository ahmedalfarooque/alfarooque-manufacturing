'use client';

/* Shared renderer for the three SmartERP ledger-backed reports (Daily Move /
   Receipts / Cash Receipts). The page supplies only a report key; everything
   else — columns, sort options, totals, title — comes from the shared
   definition in lib/ledgerReportDefs.js, which the PDF, Excel and print
   surfaces read from too. That is what keeps UI = PDF = Excel = Print.

   Filters/sorting are applied SERVER-SIDE over the complete selected period
   (see smartlifeTransactionAdapter.js), so a sort is never limited to the
   rows currently rendered and a total always covers the whole period.

   Every value is a real SmartERP journal figure; the browser only formats. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { GlassCard, GlassButton, GlassSelect, toast } from '@/components/glass';
import DateFilter, { presetRange } from '@/components/DateFilter';
import { exportReportPdf } from '@/lib/reportPdf';
import { useLanguage } from '@/lib/i18n';
import { LEDGER_REPORTS, formatCell, totalsFor, periodLabel } from '@/lib/ledgerReportDefs';

/* Default period is This Year, matching SmartLife's own Daily Move default
   — never All dates, which would open a multi-year ledger on every visit. */
const DEFAULT_FILTER = { preset: 'this_year', from: null, to: null };

function resolveRange(filter) {
  if (!filter || filter.preset === 'all') return { from: null, to: null };
  if (filter.preset === 'custom') return { from: filter.from || null, to: filter.to || null };
  return presetRange(filter.preset);
}

export default function LedgerReport({ reportKey }) {
  const report = LEDGER_REPORTS[reportKey];
  const { lang, t } = useLanguage();
  const [dateFilter, setDateFilter] = useState(DEFAULT_FILTER);
  const [branch, setBranch] = useState('');
  const [sort, setSort] = useState('entry');
  const [direction, setDirection] = useState('asc');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const range = useMemo(() => resolveRange(dateFilter), [dateFilter]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    if (branch) params.set('branch', branch);
    params.set('sort', sort);
    params.set('dir', direction);
    return params.toString();
  }, [range, branch, sort, direction]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${report.apiPath}?${queryString}`, { cache: 'no-store' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) { setError(payload?.error || 'Could not load the report.'); setData(null); }
      else setData(payload);
    } catch (_) {
      setError('Could not reach the report service.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [report.apiPath, queryString]);

  useEffect(() => { load(); }, [load]);

  const rows = data?.records || [];
  const branches = data?.branches || [];
  const period = periodLabel(range.from, range.to);
  const totals = useMemo(() => totalsFor(report, data?.totals), [report, data]);
  const branchLabel = branch ? (branches.find(b => String(b.id) === String(branch))?.name || branch) : 'All branches';

  async function downloadPdf() {
    if (!rows.length) { toast('Nothing to export for this period.'); return; }
    setBusy('pdf');
    try {
      /* The engine builds its header from `column.header` and each cell from
         `row[column.key]` — passing label strings and positional arrays (as
         an earlier version did) produced a PDF with blank headers and every
         cell rendered as "—". Columns and rows are therefore handed over in
         exactly the shape the engine consumes, formatted through the SAME
         formatCell the table uses. */
      await exportReportPdf({
        title: report.title,
        columns: report.columns.map(col => ({ key: col.key, header: col.label })),
        rows: rows.map(row => Object.fromEntries(
          report.columns.map(col => [col.key, formatCell(row, col, { blank: '' })]),
        )),
        lang,
        orientation: report.orientation,
        period,
        source: `Synchronized SmartERP general ledger · Branch: ${branchLabel}`,
        totals: totals.map(total => [total.label, total.value]),
        fileName: `${report.key}.pdf`,
      });
    } catch (_) {
      toast('Could not generate the PDF.');
    } finally {
      setBusy('');
    }
  }

  function downloadExcel() {
    if (!rows.length) { toast('Nothing to export for this period.'); return; }
    /* Server-generated from the same adapter query, so the workbook always
       matches the screen and always covers the complete period. */
    window.location.href = `/api/smartlife/ledger-export?report=${report.key}&${queryString}`;
  }

  function openPrint() {
    if (!rows.length) { toast('Nothing to print for this period.'); return; }
    window.open(`/smartlife/ledger/${report.key}/print?${queryString}&lang=${lang}`, '_blank', 'noopener');
  }

  return (
    <div className="space-y-4">
      <PageHeader title={report.title} description={report.description}
        meta={data ? `${rows.length.toLocaleString()} row(s) · ${period}` : undefined}
        actions={<GlassButton variant="secondary" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</GlassButton>} />

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[color:var(--bd)] p-3 text-sm">
        <DateFilter value={dateFilter} onChange={setDateFilter} t={t} lang={lang} />

        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">Branch
          <GlassSelect value={branch} onChange={e => setBranch(e.target.value)} className="w-40">
            <option value="">All branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </GlassSelect>
        </label>

        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">Sort by
          <GlassSelect value={sort} onChange={e => setSort(e.target.value)} className="w-44">
            {report.sorts.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </GlassSelect>
        </label>

        <div className="flex gap-1 pb-0.5">
          <GlassButton size="sm" variant={direction === 'asc' ? 'primary' : 'secondary'} onClick={() => setDirection('asc')} title="Ascending">↑ Asc</GlassButton>
          <GlassButton size="sm" variant={direction === 'desc' ? 'primary' : 'secondary'} onClick={() => setDirection('desc')} title="Descending">↓ Desc</GlassButton>
        </div>

        <div className="ms-auto flex gap-2 pb-0.5">
          <GlassButton size="sm" onClick={downloadPdf} disabled={busy === 'pdf' || !rows.length}>{busy === 'pdf' ? 'Preparing…' : 'PDF'}</GlassButton>
          <GlassButton size="sm" variant="secondary" onClick={downloadExcel} disabled={!rows.length}>Excel</GlassButton>
          <GlassButton size="sm" variant="secondary" onClick={openPrint} disabled={!rows.length}>Print</GlassButton>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}

      {!error && totals.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {totals.map(total => (
            <GlassCard key={total.label} className="p-3">
              <div className="text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">{total.label}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-[color:var(--tx)]">{total.value}</div>
            </GlassCard>
          ))}
        </div>
      )}

      {data?.formula && !error && (
        <div className="text-[11px] italic text-[color:var(--tx-4)]">{data.formula}</div>
      )}

      <GlassCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--bd)] bg-[color:var(--pr-soft)]">
                {report.columns.map(col => (
                  <th key={col.key} className={`whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--tx-3)] ${col.numeric ? 'text-end' : 'text-start'}`}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !rows.length && (
                <tr><td colSpan={report.columns.length} className="px-3 py-10 text-center text-xs text-[color:var(--tx-3)]">Loading…</td></tr>
              )}
              {!loading && !rows.length && !error && (
                <tr><td colSpan={report.columns.length} className="px-3 py-10 text-center text-xs italic text-[color:var(--tx-4)]">
                  No SmartERP records for {period.toLowerCase()}{branch ? ' in this branch' : ''}.
                </td></tr>
              )}
              {rows.map((row, index) => (
                <tr key={`${row.transaction_id || row.receipt_id}-${index}`} className="border-b border-[color:var(--bd)]">
                  {report.columns.map(col => (
                    <td key={col.key} dir={col.numeric ? 'ltr' : undefined}
                      className={`px-3 py-2 ${col.numeric ? 'whitespace-nowrap text-end tabular-nums' : col.wide ? 'max-w-[20rem] truncate' : 'whitespace-nowrap'}`}
                      title={col.wide ? String(row[col.key] ?? '') : undefined}>
                      {/* Receipt reports open the real SmartLife-style
                          voucher for that document. */}
                      {report.documentColumn === col.key && row.receipt_id
                        ? <a href={`/smartlife/receipt/${row.receipt_id}/print`} target="_blank" rel="noreferrer"
                            className="text-[color:var(--pr)] underline decoration-dotted hover:opacity-80">{formatCell(row, col)}</a>
                        : formatCell(row, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {data?.available && (
        <div className="text-[11px] text-[color:var(--tx-4)]">
          Source: synchronized SmartERP general ledger (accounting/get_entry). Amounts are exactly as posted in SmartERP.
        </div>
      )}
    </div>
  );
}
