'use client';

import { useState } from 'react';
import { GlassCard, GlassButton, GlassSelect, GlassField, GlassInput } from '@/components/glass';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function ReportsPage() {
  const [type, setType] = useState('income_statement');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

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
