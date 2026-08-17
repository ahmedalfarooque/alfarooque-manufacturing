'use client';

import { useState } from 'react';
import { useLang } from '@/lib/i18n';
import { GlassCard, GlassButton, GlassSelect, GlassField, GlassInput, toast } from '@/components/glass';
import { MetricCard, SectionCard } from '@/components/CRMWidgets';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }
const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);

/* Flattens the current report payload (whichever `type` was run) into
   generic Metric/Value rows so a single export path covers all three
   report shapes without restructuring the on-screen rendering below. */
function buildReportRows(data) {
  if (!data) return [];
  const rows = [];
  if (data.type === 'summary') {
    rows.push({ metric: 'Total Contacts', value: data.total_contacts });
    rows.push({ metric: 'Total Deals', value: data.total_deals });
    rows.push({ metric: 'Won Deals', value: data.won_deals });
    rows.push({ metric: 'Lost Deals', value: data.lost_deals });
    rows.push({ metric: 'Pipeline Value', value: `SAR ${fmt(data.pipeline_value)}` });
    rows.push({ metric: 'Won Revenue', value: `SAR ${fmt(data.won_value)}` });
    rows.push({ metric: 'Completed Activities', value: data.completed_activities });
  } else if (data.type === 'deals') {
    rows.push({ metric: 'Total Deals', value: data.total });
    rows.push({ metric: 'Total Value', value: `SAR ${fmt(data.total_value)}` });
    rows.push({ metric: 'Won Value', value: `SAR ${fmt(data.won_value)}` });
    for (const [k, v] of Object.entries(data.by_status || {})) rows.push({ metric: `Status: ${k}`, value: v });
    for (const [k, v] of Object.entries(data.by_stage || {})) rows.push({ metric: `Stage: ${k}`, value: v });
  } else if (data.type === 'activities') {
    rows.push({ metric: 'Total Activities', value: data.total });
    rows.push({ metric: 'Completed', value: data.completed });
    for (const [k, v] of Object.entries(data.by_type || {})) rows.push({ metric: `Type: ${k}`, value: v });
  }
  return rows;
}

const REPORT_TITLE = { summary: 'Summary Overview', deals: 'Deals Analysis', activities: 'Activities Report' };

export default function ReportsPage() {
  const { t, lang } = useLang();
  const [type, setType] = useState('summary');
  const [from, setFrom] = useState(yearStart());
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

  const exportRows = buildReportRows(data);

  async function runPdf(action) {
    setReportBusy(action);
    try {
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({
        title: REPORT_TITLE[data?.type] || 'CRM Report',
        columns: [{ key: 'metric', header: 'Metric' }, { key: 'value', header: 'Value' }],
        rows: exportRows,
        lang, fileName: 'crm-report.pdf', action,
      });
    } catch (e) { toast('Report generation failed', 'error'); }
    finally { setReportBusy(''); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[color:var(--tx)]">CRM Reports</h1>
        <div className="flex items-center gap-2">
          <GlassButton variant="secondary" onClick={() => runPdf('print')} disabled={!exportRows.length || !!reportBusy}>{reportBusy === 'print' ? '…' : t('print')}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runPdf('save')} disabled={!exportRows.length || !!reportBusy}>⇩ {reportBusy === 'save' ? '…' : t('downloadPdf')}</GlassButton>
        </div>
      </div>

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
        <div className="space-y-4">
          {data.type === 'summary' && (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard label="Total Contacts" value={data.total_contacts} icon="users" tone="cyan" />
                <MetricCard label="Total Deals" value={data.total_deals} icon="flag" tone="violet" />
                <MetricCard label="Won Deals" value={data.won_deals} icon="gem" tone="emerald" />
                <MetricCard label="Lost Deals" value={data.lost_deals} icon="x" tone="red" />
                <MetricCard label="Pipeline Value" value={`SAR ${fmt(data.pipeline_value)}`} icon="chart" tone="cyan" />
                <MetricCard label="Won Revenue" value={`SAR ${fmt(data.won_value)}`} icon="chart" tone="emerald" />
                <MetricCard label="Completed Activities" value={data.completed_activities} icon="clock" tone="amber" />
              </div>
              <SectionCard title="Summary Overview">
                <p className="text-sm text-[color:var(--tx-3)]">All-time totals across contacts, deals, and activities.</p>
              </SectionCard>
            </>
          )}

          {data.type === 'deals' && (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <MetricCard label="Total Deals" value={data.total} icon="flag" tone="cyan" />
                <MetricCard label="Total Value" value={`SAR ${fmt(data.total_value)}`} icon="chart" tone="violet" />
                <MetricCard label="Won Value" value={`SAR ${fmt(data.won_value)}`} icon="gem" tone="emerald" />
                <MetricCard label="Win Rate" value={data.total ? `${Math.round(((data.by_status?.Won || 0) / data.total) * 100)}%` : '—'} icon="target" tone="amber" />
              </div>
              <SectionCard title="Deals Analysis" subtitle={`${data.from} to ${data.to}`}>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--tx-2)] mb-2">By Status</h3>
                    {Object.entries(data.by_status || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-sm py-1 border-b border-[color:var(--bd)]">
                        <span className="text-[color:var(--tx-2)]">{k}</span>
                        <span className="text-[color:var(--tx)] font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--tx-2)] mb-2">By Stage</h3>
                    {Object.entries(data.by_stage || {}).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-sm py-1 border-b border-[color:var(--bd)]">
                        <span className="text-[color:var(--tx-2)]">{k}</span>
                        <span className="text-[color:var(--tx)] font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>
            </>
          )}

          {data.type === 'activities' && (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                <MetricCard label="Total Activities" value={data.total} icon="clock" tone="cyan" />
                <MetricCard label="Completed" value={data.completed} icon="gem" tone="emerald" />
                <MetricCard label="Completion Rate" value={data.total ? `${Math.round((data.completed / data.total) * 100)}%` : '—'} icon="target" tone="amber" />
              </div>
              <SectionCard title="Activities Report" subtitle={`${data.from} to ${data.to}`}>
                <h3 className="text-sm font-semibold text-[color:var(--tx-2)] mb-2">By Type</h3>
                {Object.entries(data.by_type || {}).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm py-1 border-b border-[color:var(--bd)]">
                    <span className="text-[color:var(--tx-2)]">{k}</span>
                    <span className="text-[color:var(--tx)] font-medium">{v}</span>
                  </div>
                ))}
              </SectionCard>
            </>
          )}
        </div>
      )}
    </div>
  );
}
