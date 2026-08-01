'use client';

import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge } from '@/components/glass';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function StatTile({ label, value, sub }) {
  return (
    <GlassCard>
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </GlassCard>
  );
}

function statusTone(s) {
  if (s === 'Paid') return 'success';
  if (s === 'Overdue') return 'error';
  if (s === 'Draft') return 'neutral';
  return 'info';
}

export default function DashboardPage() {
  const { data, loading } = useLiveData('/api/dashboard', 30000);
  const d = data || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Accounting Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Financial overview</p>
      </div>

      {loading && !data ? (
        <div className="text-center text-slate-400 py-12">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Total Receivable" value={`SAR ${fmt(d.totalReceivable)}`} />
            <StatTile label="Total Payable" value={`SAR ${fmt(d.totalPayable)}`} />
            <StatTile label="Cash & Bank Balance" value={`SAR ${fmt(d.cashBalance)}`} />
            <StatTile label="Journal Entries (Month)" value={d.monthJournalCount ?? '—'} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <GlassCard>
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Recent Invoices</h3>
              {!(d.recentInvoices || []).length ? (
                <p className="text-slate-500 text-sm">No invoices yet.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {(d.recentInvoices || []).map(inv => (
                    <div key={inv.id} className="py-2 flex items-center justify-between text-sm">
                      <div>
                        <span className="text-white font-medium">{inv.invoice_number || inv.id.slice(0, 8)}</span>
                        <span className="text-slate-400 ml-2">{inv.customer_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300">SAR {fmt(inv.total_amount)}</span>
                        <GlassBadge tone={statusTone(inv.status)}>{inv.status}</GlassBadge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            <GlassCard>
              <h3 className="text-sm font-semibold text-slate-300 mb-4">Recent Bills</h3>
              {!(d.recentBills || []).length ? (
                <p className="text-slate-500 text-sm">No bills yet.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {(d.recentBills || []).map(bill => (
                    <div key={bill.id} className="py-2 flex items-center justify-between text-sm">
                      <div>
                        <span className="text-white font-medium">{bill.bill_number || bill.id.slice(0, 8)}</span>
                        <span className="text-slate-400 ml-2">{bill.vendor_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300">SAR {fmt(bill.total_amount)}</span>
                        <GlassBadge tone={statusTone(bill.status)}>{bill.status}</GlassBadge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          <GlassCard>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">Month Expenses</h3>
            <p className="text-2xl font-bold text-white">SAR {fmt(d.monthExpenses)}</p>
          </GlassCard>
        </>
      )}
    </div>
  );
}
