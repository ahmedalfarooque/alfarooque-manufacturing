'use client';

import { useState } from 'react';
import { GlassCard, GlassButton, GlassSelect, GlassField, GlassInput, toast } from '@/components/glass';
import { exportReportPdf } from '@/lib/reportPdf';

const REPORT_TITLES = {
  income_statement: 'Income Statement (P&L)',
  balance_sheet: 'Balance Sheet',
  cash_flow: 'Cash Flow Statement',
  vat: 'VAT Report (ZATCA)',
  inventory_valuation: 'Inventory Valuation',
  project_costing: 'Project Costing',
  summary: 'Summary Dashboard',
};

/* Financial Reports has 7 distinct report shapes (a two-column
   label/value summary for most, a real table for the two line-item
   reports). Build generic {columns, rows} for whichever shape is
   currently on screen instead of a second bespoke renderer per type —
   same shared A4 report engine as every other Accounting list. */
function buildReportPayload(data) {
  if (data.type === 'inventory_valuation') {
    return {
      columns: [
        { key: 'name', header: 'Item' }, { key: 'code', header: 'Code' }, { key: 'warehouse', header: 'Warehouse' },
        { key: 'qtyText', header: 'Qty' }, { key: 'avgCostText', header: 'Avg Cost' }, { key: 'valueText', header: 'Value' },
      ],
      rows: (data.lines || []).map(l => ({ ...l, qtyText: fmt(l.qty), avgCostText: fmt(l.avg_cost), valueText: fmt(l.value) })),
      totals: [['Total Stock Value', `SAR ${fmt(data.total_value)}`]],
    };
  }
  if (data.type === 'project_costing') {
    return {
      columns: [
        { key: 'project_name', header: 'Project' }, { key: 'revenueText', header: 'Revenue (Invoiced)' },
        { key: 'costText', header: 'Cost (Bills + Expenses)' }, { key: 'marginText', header: 'Margin' },
      ],
      rows: (data.projects || []).map(p => ({ ...p, revenueText: fmt(p.revenue), costText: fmt(p.cost), marginText: fmt(p.margin) })),
      totals: [],
    };
  }
  /* income_statement / balance_sheet / cash_flow / vat / summary — all a
     flat list of labelled figures, rendered as a two-column table. */
  const pairs = [];
  if (data.type === 'income_statement') {
    pairs.push(['Revenue', data.revenue], ['Cost of Goods Sold', data.cogs], ['Gross Profit', data.gross_profit], ['Operating Expenses', data.opex], ['Net Income', data.net_income]);
  } else if (data.type === 'balance_sheet') {
    pairs.push(['Cash & Bank', data.cash], ['Accounts Receivable', data.receivables], ['Fixed Assets (Net)', data.fixed_assets], ['Total Assets', data.total_assets],
      ['Accounts Payable', data.payables], ['Total Liabilities', data.payables], ['Equity', data.equity]);
  } else if (data.type === 'cash_flow') {
    pairs.push(['Cash Inflows', data.inflows], ['Cash Outflows', data.outflows], ['Net Cash Flow', data.net_cash_flow]);
  } else if (data.type === 'vat') {
    pairs.push(['Output VAT (Sales)', data.output_vat], ['Input VAT (Purchases)', data.input_vat], ['Net VAT Payable', data.net_vat_payable]);
  } else if (data.type === 'summary') {
    pairs.push(['Total Invoices', data.total_invoices], ['Total Bills', data.total_bills], ['Approved Expenses', `SAR ${fmt(data.total_expenses)}`],
      ['Posted Journal Entries', data.total_journal_entries], ['Total Bank Balance', `SAR ${fmt(data.total_bank_balance)}`]);
  }
  return {
    columns: [{ key: 'label', header: 'Line Item' }, { key: 'valueText', header: 'Amount' }],
    rows: pairs.map(([label, value]) => ({ label, valueText: typeof value === 'number' ? `SAR ${fmt(value)}` : String(value ?? '—') })),
    totals: [],
  };
}

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function ReportsPage() {
  const [type, setType] = useState('income_statement');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reportBusy, setReportBusy] = useState('');

  async function run() {
    setLoading(true);
    setData(null);
    try {
      const params = new URLSearchParams({ type, from, to });
      const res = await fetch(`/api/reports?${params}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed');
      setData(body);
    } catch (e) { alert(e.message); }
    finally { setLoading(false); }
  }

  /* Same shared A4 report engine as the rest of Accounting — reuses the
     figures already computed and shown on screen, no recomputation. */
  async function runPdf(action) {
    if (!data) return;
    setReportBusy(action);
    try {
      const { columns, rows, totals } = buildReportPayload(data);
      const rangeSuffix = (type !== 'balance_sheet' && type !== 'summary' && type !== 'inventory_valuation') ? ` — ${data.from} to ${data.to}` : '';
      await exportReportPdf({
        title: `${REPORT_TITLES[type] || 'Financial Report'}${rangeSuffix}`,
        columns, rows, totals,
        period: rangeSuffix ? `${data.from} to ${data.to}` : 'As of today',
        fileName: `${type}-report.pdf`, action,
      });
    } catch (e) { toast(e.message || 'Could not generate report.', 'error'); }
    finally { setReportBusy(''); }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Financial Reports</h1>

      <GlassCard>
        <div className="flex gap-3 items-end flex-wrap">
          <GlassField label="Report Type" className="min-w-48">
            <GlassSelect value={type} onChange={e => setType(e.target.value)}>
              <option value="income_statement">Income Statement (P&L)</option>
              <option value="balance_sheet">Balance Sheet</option>
              <option value="cash_flow">Cash Flow Statement</option>
              <option value="vat">VAT Report (ZATCA)</option>
              <option value="inventory_valuation">Inventory Valuation</option>
              <option value="project_costing">Project Costing</option>
              <option value="summary">Summary Dashboard</option>
            </GlassSelect>
          </GlassField>
          {type !== 'balance_sheet' && type !== 'summary' && type !== 'inventory_valuation' && (
            <>
              <GlassField label="From">
                <GlassInput type="date" value={from} onChange={e => setFrom(e.target.value)} />
              </GlassField>
              <GlassField label="To">
                <GlassInput type="date" value={to} onChange={e => setTo(e.target.value)} />
              </GlassField>
            </>
          )}
          <GlassButton onClick={run} disabled={loading}>{loading ? 'Generating…' : 'Run Report'}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runPdf('print')} disabled={!data || !!reportBusy}>{reportBusy === 'print' ? 'Preparing…' : 'Print'}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runPdf('save')} disabled={!data || !!reportBusy}>{reportBusy === 'save' ? 'Generating…' : 'Download PDF'}</GlassButton>
        </div>
      </GlassCard>

      {data && (
        <GlassCard>
          {data.type === 'income_statement' && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Income Statement — {data.from} to {data.to}</h2>
              <table className="w-full text-sm">
                <tbody>
                  <ReportRow label="Revenue" value={data.revenue} bold />
                  <ReportRow label="Cost of Goods Sold" value={data.cogs} negative />
                  <ReportRow label="Gross Profit" value={data.gross_profit} bold highlight />
                  <ReportRow label="Operating Expenses" value={data.opex} negative />
                  <ReportRow label="Net Income" value={data.net_income} bold highlight={data.net_income >= 0} danger={data.net_income < 0} />
                </tbody>
              </table>
            </div>
          )}

          {data.type === 'balance_sheet' && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Balance Sheet (As of Today)</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Assets</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      <ReportRow label="Cash & Bank" value={data.cash} />
                      <ReportRow label="Accounts Receivable" value={data.receivables} />
                      <ReportRow label="Fixed Assets (Net)" value={data.fixed_assets} />
                      <ReportRow label="Total Assets" value={data.total_assets} bold highlight />
                    </tbody>
                  </table>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Liabilities & Equity</h3>
                  <table className="w-full text-sm">
                    <tbody>
                      <ReportRow label="Accounts Payable" value={data.payables} />
                      <ReportRow label="Total Liabilities" value={data.payables} bold />
                      <ReportRow label="Equity" value={data.equity} bold highlight />
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {data.type === 'cash_flow' && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Cash Flow — {data.from} to {data.to}</h2>
              <table className="w-full text-sm">
                <tbody>
                  <ReportRow label="Cash Inflows" value={data.inflows} />
                  <ReportRow label="Cash Outflows" value={data.outflows} negative />
                  <ReportRow label="Net Cash Flow" value={data.net_cash_flow} bold highlight={data.net_cash_flow >= 0} danger={data.net_cash_flow < 0} />
                </tbody>
              </table>
            </div>
          )}

          {data.type === 'vat' && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">VAT Report — {data.from} to {data.to}</h2>
              <table className="w-full text-sm">
                <tbody>
                  <ReportRow label="Output VAT (Sales)" value={data.output_vat} />
                  <ReportRow label="Input VAT (Purchases)" value={data.input_vat} negative />
                  <ReportRow label="Net VAT Payable" value={data.net_vat_payable} bold highlight={data.net_vat_payable >= 0} danger={data.net_vat_payable < 0} />
                </tbody>
              </table>
              <p className="text-xs text-slate-500 mt-4">For ZATCA filing — verify figures before submission.</p>
            </div>
          )}

          {data.type === 'inventory_valuation' && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Inventory Valuation</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="rounded-lg bg-white/5 p-4">
                  <p className="text-xs text-slate-400">Total Stock Value</p>
                  <p className="text-xl font-bold text-cyan-400 mt-1">SAR {fmt(data.total_value)}</p>
                </div>
                {Object.entries(data.by_warehouse || {}).map(([wh, val]) => (
                  <div key={wh} className="rounded-lg bg-white/5 p-4">
                    <p className="text-xs text-slate-400">{wh}</p>
                    <p className="text-xl font-bold text-white mt-1">SAR {fmt(val)}</p>
                  </div>
                ))}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="text-start py-2">Item</th>
                    <th className="text-start py-2">Code</th>
                    <th className="text-start py-2">Warehouse</th>
                    <th className="text-end py-2">Qty</th>
                    <th className="text-end py-2">Avg Cost</th>
                    <th className="text-end py-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.lines || []).map((l, i) => (
                    <tr key={i} className="border-b border-white/5">
                      <td className="py-2 text-white">{l.name}</td>
                      <td className="py-2 text-slate-400">{l.code}</td>
                      <td className="py-2 text-slate-400">{l.warehouse}</td>
                      <td className="py-2 text-end">{fmt(l.qty)}</td>
                      <td className="py-2 text-end">{fmt(l.avg_cost)}</td>
                      <td className="py-2 text-end font-semibold text-white">{fmt(l.value)}</td>
                    </tr>
                  ))}
                  {!data.lines?.length && <tr><td colSpan={6} className="text-center text-slate-500 py-8">No stock on hand.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {data.type === 'project_costing' && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Project Costing — {data.from} to {data.to}</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="text-start py-2">Project</th>
                    <th className="text-end py-2">Revenue (Invoiced)</th>
                    <th className="text-end py-2">Cost (Bills + Expenses)</th>
                    <th className="text-end py-2">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.projects || []).map(p => (
                    <tr key={p.project_id} className="border-b border-white/5">
                      <td className="py-2 text-white">{p.project_name}</td>
                      <td className="py-2 text-end">{fmt(p.revenue)}</td>
                      <td className="py-2 text-end">{fmt(p.cost)}</td>
                      <td className={`py-2 text-end font-semibold ${p.margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(p.margin)}</td>
                    </tr>
                  ))}
                  {!data.projects?.length && <tr><td colSpan={4} className="text-center text-slate-500 py-8">No project-tagged costs in this range.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {data.type === 'summary' && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Total Invoices', value: data.total_invoices },
                  { label: 'Total Bills', value: data.total_bills },
                  { label: 'Approved Expenses', value: `SAR ${fmt(data.total_expenses)}` },
                  { label: 'Posted Journal Entries', value: data.total_journal_entries },
                  { label: 'Total Bank Balance', value: `SAR ${fmt(data.total_bank_balance)}` },
                ].map(s => (
                  <div key={s.label} className="rounded-lg bg-white/5 p-4">
                    <p className="text-xs text-slate-400">{s.label}</p>
                    <p className="text-xl font-bold text-white mt-1">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}

function ReportRow({ label, value, bold, negative, highlight, danger }) {
  const displayVal = `SAR ${fmt(Math.abs(value || 0))}`;
  return (
    <tr className="border-b border-white/5">
      <td className={`py-2 px-2 ${bold ? 'font-bold text-white' : 'text-slate-300'}`}>{label}</td>
      <td className={`py-2 px-2 text-right font-mono ${bold ? 'font-bold' : ''} ${highlight ? 'text-emerald-400' : danger ? 'text-rose-400' : negative ? 'text-rose-300' : 'text-white'}`}>
        {negative && value > 0 ? `(${displayVal})` : displayVal}
      </td>
    </tr>
  );
}
