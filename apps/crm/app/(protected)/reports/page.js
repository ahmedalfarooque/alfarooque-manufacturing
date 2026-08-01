'use client';

import { useState } from 'react';
import { GlassCard, GlassButton, GlassSelect, GlassField, GlassInput } from '@/components/glass';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }
const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

export default function ReportsPage() {
  const [type, setType] = useState('summary');
  const [from, setFrom] = useState(yearStart());
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
      <h1 className="text-2xl font-bold text-white">CRM Reports</h1>

      <GlassCard>
        <div className="flex gap-3 items-end flex-wrap">
          <GlassField label="Report Type">
            <GlassSelect value={type} onChange={e => setType(e.target.value)}>
              <option value="summary">Summary Overview</option>
              <option value="deals">Deals Analysis</option>
              <option value="activities">Activities Report</option>
            </GlassSelect>
          </GlassField>
          {type !== 'summary' && (
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
          {data.type === 'summary' && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Summary Overview</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Total Contacts', value: data.total_contacts },
                  { label: 'Total Deals', value: data.total_deals },
                  { label: 'Won Deals', value: data.won_deals },
                  { label: 'Lost Deals', value: data.lost_deals },
                  { label: 'Pipeline Value', value: `SAR ${fmt(data.pipeline_value)}` },
                  { label: 'Won Revenue', value: `SAR ${fmt(data.won_value)}` },
                  { label: 'Completed Activities', value: data.completed_activities },
                ].map(s => (
                  <div key={s.label} className="rounded-lg bg-white/5 p-4">
                    <p className="text-xs text-slate-400">{s.label}</p>
                    <p className="text-xl font-bold text-white mt-1">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.type === 'deals' && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Deals — {data.from} to {data.to}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Stat label="Total Deals" value={data.total} />
                <Stat label="Total Value" value={`SAR ${fmt(data.total_value)}`} />
                <Stat label="Won Value" value={`SAR ${fmt(data.won_value)}`} />
                <Stat label="Win Rate" value={data.total ? `${Math.round(((data.by_status?.Won || 0) / data.total) * 100)}%` : '—'} />
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">By Status</h3>
                  {Object.entries(data.by_status || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm py-1 border-b border-white/5">
                      <span className="text-slate-300">{k}</span>
                      <span className="text-white font-medium">{v}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">By Stage</h3>
                  {Object.entries(data.by_stage || {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm py-1 border-b border-white/5">
                      <span className="text-slate-300">{k}</span>
                      <span className="text-white font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {data.type === 'activities' && (
            <div>
              <h2 className="text-lg font-bold text-white mb-4">Activities — {data.from} to {data.to}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <Stat label="Total Activities" value={data.total} />
                <Stat label="Completed" value={data.completed} />
                <Stat label="Completion Rate" value={data.total ? `${Math.round((data.completed / data.total) * 100)}%` : '—'} />
              </div>
              <h3 className="text-sm font-semibold text-slate-300 mb-2">By Type</h3>
              {Object.entries(data.by_type || {}).map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm py-1 border-b border-white/5">
                  <span className="text-slate-300">{k}</span>
                  <span className="text-white font-medium">{v}</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-white/5 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}
