'use client';

/* Shared renderer for the three SmartERP ledger-backed transaction reports
   (Daily Move / Receipts / Cash Receipts). One component, one report
   definition per page: the page supplies title, description, api path and a
   column definition, and this handles filters, totals, table, PDF export,
   and the loading / empty / error states.

   Every value shown is a real SmartERP journal figure served by
   /api/smartlife/* (see apps/accounting/lib/smartlifeTransactionAdapter.js).
   Nothing is computed in the browser except display formatting — the
   documented report formula is returned by the API and shown to the user. */

import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/PageHeader';
import { GlassCard, GlassButton, GlassSelect, toast } from '@/components/glass';
import { exportReportPdf } from '@/lib/reportPdf';
import { useLanguage } from '@/lib/i18n';

function money(value) {
  if (value == null || value === '') return '—';
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function plain(value) {
  return value == null || value === '' ? '—' : String(value);
}
function cellText(row, col) {
  return col.numeric ? money(row[col.key]) : plain(row[col.key]);
}

export default function LedgerReport({ title, description, apiPath, columns, totalsSpec }) {
  const { lang } = useLanguage();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [branch, setBranch] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (branch) params.set('branch', branch);
    try {
      const res = await fetch(`${apiPath}${params.toString() ? `?${params}` : ''}`, { cache: 'no-store' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) { setError(payload?.error || 'Could not load the report.'); setData(null); }
      else setData(payload);
    } catch (_) {
      setError('Could not reach the report service.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiPath, from, to, branch]);

  useEffect(() => { load(); }, [load]);

  const rows = data?.records || [];
  const branches = data?.branches || [];
  const periodLabel = useMemo(() => (from && to ? `${from} to ${to}` : from ? `From ${from}` : to ? `Until ${to}` : 'All dates'), [from, to]);

  const totals = useMemo(() => {
    if (!data?.totals) return [];
    return (totalsSpec || []).map(spec => ({
      label: spec.label,
      value: spec.numeric === false ? plain(data.totals[spec.key]) : money(data.totals[spec.key]),
    }));
  }, [data, totalsSpec]);

  async function downloadPdf() {
    if (!rows.length) { toast('Nothing to export for this period.'); return; }
    setPdfBusy(true);
    try {
      await exportReportPdf({
        title,
        columns: columns.map(c => c.label),
        rows: rows.map(row => columns.map(col => cellText(row, col))),
        lang,
        period: periodLabel,
        source: 'Synchronized SmartERP general ledger (accounting/get_entry)',
        totals: totals.map(t => [t.label, t.value]),
        fileName: `${title.toLowerCase().replace(/\s+/g, '-')}.pdf`,
      });
    } catch (_) {
      toast('Could not generate the PDF.');
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={title} description={description}
        meta={data?.available ? `${rows.length.toLocaleString()} row(s) · ${periodLabel}` : undefined}
        actions={<GlassButton variant="secondary" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</GlassButton>} />

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[color:var(--bd)] p-3 text-sm">
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">From
          <input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)}
            className="rounded-lg border border-[color:var(--bd)] bg-transparent px-2 py-1.5 text-sm text-[color:var(--tx)]" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">To
          <input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)}
            className="rounded-lg border border-[color:var(--bd)] bg-transparent px-2 py-1.5 text-sm text-[color:var(--tx)]" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">Branch
          <GlassSelect value={branch} onChange={e => setBranch(e.target.value)} className="w-44">
            <option value="">All branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </GlassSelect>
        </label>
        {(from || to || branch) && (
          <GlassButton size="sm" variant="secondary" onClick={() => { setFrom(''); setTo(''); setBranch(''); }}>Clear</GlassButton>
        )}
        <GlassButton size="sm" onClick={downloadPdf} disabled={pdfBusy || !rows.length}>{pdfBusy ? 'Preparing…' : 'Export PDF'}</GlassButton>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
      )}

      {!error && totals.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {totals.map(t => (
            <GlassCard key={t.label} className="p-3">
              <div className="text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">{t.label}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums text-[color:var(--tx)]">{t.value}</div>
            </GlassCard>
          ))}
        </div>
      )}

      {data?.truncationNote && !error && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-[color:var(--tx-2)]">
          <span className="font-semibold uppercase tracking-wide text-amber-300">Partial period</span>
          <p className="mt-1 text-[color:var(--tx-3)]">{data.truncationNote}</p>
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
                {columns.map(col => (
                  <th key={col.key} className={`whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--tx-3)] ${col.numeric ? 'text-end' : 'text-start'}`}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && !rows.length && (
                <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-xs text-[color:var(--tx-3)]">Loading…</td></tr>
              )}
              {!loading && !rows.length && !error && (
                <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-xs italic text-[color:var(--tx-4)]">
                  No SmartERP records for this period{branch ? ' and branch' : ''}.
                </td></tr>
              )}
              {rows.map((row, i) => (
                <tr key={`${row.transaction_id || row.receipt_id}-${i}`} className="border-b border-[color:var(--bd)]">
                  {columns.map(col => (
                    <td key={col.key} dir={col.numeric ? 'ltr' : undefined}
                      className={`whitespace-nowrap px-3 py-2 ${col.numeric ? 'text-end tabular-nums' : ''} ${col.wide ? 'max-w-[22rem] truncate whitespace-normal' : ''}`}
                      title={col.wide ? plain(row[col.key]) : undefined}>
                      {cellText(row, col)}
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
