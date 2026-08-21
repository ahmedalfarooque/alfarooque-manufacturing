'use client';

/* Dedicated print sheet for the ledger reports — deliberately OUTSIDE the
   (protected) app shell, the same pattern the invoice print pages use, so
   the printed page carries no sidebar, header nav or filter controls. It
   re-fetches through the same API with the same query string it was opened
   with, so what prints is exactly what the report showed.

   Columns and totals come from the shared report definition, so this can
   never print a different column set than the screen or the exports. */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { LEDGER_REPORTS, formatCell, totalsFor, periodLabel } from '@/lib/ledgerReportDefs';

const COMPANY = {
  name: 'ALFAROOQUE WOOD WORKS FACTORY',
  address: 'Bahara, Jeddah, Saudi Arabia',
  cr: '4031098279',
  vat: '312048700900003',
  phone: '0564466661',
  email: 'chairman@alfarooque.com',
};

export default function LedgerPrintPage() {
  const { report: reportKey } = useParams();
  const report = LEDGER_REPORTS[String(reportKey)];
  const [state, setState] = useState({ status: 'loading' });
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!report) { setState({ status: 'error', error: 'Unknown report.' }); return; }
    const search = typeof window === 'undefined' ? '' : window.location.search.replace(/^\?/, '');
    setQuery(search);
    fetch(`${report.apiPath}?${search}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error || 'Could not load the report.');
        return body;
      })
      .then(body => setState({ status: 'ready', body }))
      .catch(error => setState({ status: 'error', error: error.message }));
  }, [report]);

  /* Print only once the real rows are on the page — printing while still
     loading would produce an empty sheet. */
  useEffect(() => {
    if (state.status !== 'ready') return;
    const timer = setTimeout(() => { try { window.print(); } catch (_) {} }, 350);
    return () => clearTimeout(timer);
  }, [state.status]);

  const params = useMemo(() => new URLSearchParams(query), [query]);
  const rows = state.body?.records || [];
  const totals = report ? totalsFor(report, state.body?.totals) : [];
  const period = periodLabel(params.get('from'), params.get('to'));
  const branchId = params.get('branch');
  const branchName = branchId
    ? (state.body?.branches || []).find(b => String(b.id) === String(branchId))?.name || branchId
    : 'All branches';

  if (!report) return <div style={{ padding: 40, fontFamily: 'sans-serif' }}>Unknown report.</div>;
  if (state.status === 'loading') return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#666' }}>Preparing {report.title}…</div>;
  if (state.status === 'error') return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#b00' }}>{state.error}</div>;

  return (
    <div className="sheet">
      <style>{`
        @page { size: A4 landscape; margin: 12mm 10mm 14mm 10mm; }
        html, body { background: #fff; }
        .sheet { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; color: #1a1a18; padding: 16px; }
        .hdr { display: flex; justify-content: space-between; align-items: flex-start;
               border-bottom: 2px solid #0f877e; padding-bottom: 8px; margin-bottom: 10px; }
        .co-name { font-size: 15px; font-weight: 700; letter-spacing: .3px; }
        .co-meta { font-size: 9.5px; color: #55534c; line-height: 1.5; margin-top: 2px; }
        .rpt { text-align: right; }
        .rpt-title { font-size: 15px; font-weight: 700; color: #0f877e; }
        .rpt-meta { font-size: 9.5px; color: #55534c; line-height: 1.6; }
        table { width: 100%; border-collapse: collapse; font-size: 8.6px; }
        thead { display: table-header-group; }
        tfoot { display: table-footer-group; }
        th { background: #0f877e; color: #fff; font-weight: 700; text-align: left;
             padding: 4px 5px; border: .5px solid #cfd6d4; }
        td { padding: 3px 5px; border: .5px solid #dfdcd6; vertical-align: top; }
        tbody tr:nth-child(even) td { background: #f7f5f1; }
        .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
        tr { page-break-inside: avoid; }
        .totals { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 18px;
                  border-top: 1.5px solid #0f877e; padding-top: 7px; }
        .totals div span { display: block; font-size: 8.5px; color: #55534c; text-transform: uppercase; letter-spacing: .4px; }
        .totals div strong { font-size: 11.5px; }
        .src { margin-top: 8px; font-size: 8px; color: #6e6c64; }
        @media print { .noprint { display: none !important; } }
      `}</style>

      <div className="noprint" style={{ marginBottom: 10 }}>
        <button type="button" onClick={() => window.print()}
          style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #0f877e', background: '#0f877e', color: '#fff', cursor: 'pointer' }}>
          Print
        </button>
      </div>

      <div className="hdr">
        <div>
          <div className="co-name">{COMPANY.name}</div>
          <div className="co-meta">
            {COMPANY.address}<br />
            CR: {COMPANY.cr} · VAT: {COMPANY.vat}<br />
            {COMPANY.phone} · {COMPANY.email}
          </div>
        </div>
        <div className="rpt">
          <div className="rpt-title">{report.title}</div>
          <div className="rpt-meta">
            Period: {period}<br />
            Branch: {branchName}<br />
            Rows: {rows.length.toLocaleString()}<br />
            Generated: {new Date().toISOString().slice(0, 10)}
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>{report.columns.map(col => <th key={col.key} className={col.numeric ? 'num' : undefined}>{col.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.transaction_id || row.receipt_id}-${index}`}>
              {report.columns.map(col => (
                <td key={col.key} className={col.numeric ? 'num' : undefined}>{formatCell(row, col, { blank: '' })}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {totals.length > 0 && (
        <div className="totals">
          {totals.map(total => (
            <div key={total.label}><span>{total.label}</span><strong>{total.value}</strong></div>
          ))}
        </div>
      )}

      <div className="src">Source: synchronized SmartERP general ledger (accounting/get_entry). Amounts exactly as posted in SmartERP.</div>
    </div>
  );
}
