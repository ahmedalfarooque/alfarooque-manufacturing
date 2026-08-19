'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { useLang } from '@/lib/i18n';
import { GlassCard, GlassBadge, GlassButton, toast } from '@/components/glass';
import { CRMEmptyState } from '@/components/CRMWidgets';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 0 }); }

/* Stage → shared tone system (same palette used across MetricCard/GlassBadge
   elsewhere in the CRM) instead of one-off Tailwind colors, so the Kanban
   stays visually consistent with the rest of the app in both themes. */
const STAGE_TONE = {
  'Prospecting': 'slate',
  'Qualification': 'cyan',
  'Proposal': 'amber',
  'Negotiation': 'violet',
  'Closed Won': 'emerald',
  'Closed Lost': 'red',
};
function stageTone(stage) { return STAGE_TONE[stage] || 'slate'; }

export default function PipelinePage() {
  const { t, lang } = useLang();
  const { data, loading } = useLiveData('/api/pipeline', 20000);
  const [reportBusy, setReportBusy] = useState('');

  const flatDeals = (data?.pipeline || []).flatMap(col => (col.deals || []).map(d => ({
    stage: col.stage, title: d.title || '—', contact: d.crm_contacts?.name || '—',
    company: d.crm_contacts?.company || '—', value: `SAR ${fmt(d.value)}`,
    probability: d.probability != null ? `${d.probability}%` : '—', close: d.expected_close_date || '—',
  })));

  async function runReport(action) {
    setReportBusy(action);
    try {
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({
        title: 'Sales Pipeline',
        columns: [
          { key: 'stage', header: 'Stage' }, { key: 'title', header: 'Deal' },
          { key: 'contact', header: 'Contact' }, { key: 'company', header: 'Company' },
          { key: 'value', header: 'Value' }, { key: 'probability', header: 'Probability' },
          { key: 'close', header: 'Close Date' },
        ],
        rows: flatDeals,
        lang, fileName: 'pipeline-report.pdf', action,
      });
    } catch (e) { toast('Report generation failed', 'error'); }
    finally { setReportBusy(''); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[color:var(--tx)]">Sales Pipeline</h1>
        <div className="flex items-center gap-3">
          {data && (
            <div className="text-sm text-[color:var(--tx-3)]">
              <span className="text-[color:var(--tx)] font-medium">{data.total_open}</span> open deals ·{' '}
              <span className="text-[color:var(--pr)] font-medium">SAR {fmt(data.total_value)}</span> total value
            </div>
          )}
          <GlassButton variant="secondary" size="sm" onClick={() => runReport('print')} disabled={!flatDeals.length || !!reportBusy}>{reportBusy === 'print' ? '…' : t('print')}</GlassButton>
          <GlassButton variant="secondary" size="sm" onClick={() => runReport('save')} disabled={!flatDeals.length || !!reportBusy}>⇩ {reportBusy === 'save' ? '…' : t('downloadPdf')}</GlassButton>
        </div>
      </div>

      {loading && !data ? (
        <div className="text-center text-[color:var(--tx-3)] py-12">Loading pipeline…</div>
      ) : !flatDeals.length ? (
        <CRMEmptyState
          title="No deals in the pipeline"
          text="Deals will appear here as soon as they're created, grouped by sales stage."
        />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {(data?.pipeline || []).map(col => (
            <div key={col.stage} className="flex-shrink-0 w-64">
              <GlassCard flat className="mb-3 !p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={'crm-timeline-dot crm-timeline-dot--' + (stageTone(col.stage) === 'slate' || stageTone(col.stage) === 'violet' ? 'cyan' : stageTone(col.stage))} style={{ width: 10, height: 10 }} aria-hidden="true" />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--tx-2)] truncate">{col.stage}</h3>
                  </div>
                  <GlassBadge tone={stageTone(col.stage)}>{col.count}</GlassBadge>
                </div>
                <p className="mt-1.5 text-xs text-[color:var(--tx-4)]" dir="ltr">SAR {fmt(col.total_value)}</p>
              </GlassCard>

              <div className="space-y-2">
                {col.deals.map(deal => (
                  <Link key={deal.id} href={`/deals/${deal.id}`}>
                    <GlassCard className="hover:ring-1 hover:ring-[color:var(--pr)]/50 transition-all cursor-pointer">
                      <p className="text-[color:var(--tx)] text-sm font-medium">{deal.title}</p>
                      {deal.crm_contacts && (
                        <p className="text-[color:var(--tx-3)] text-xs mt-1 truncate">{deal.crm_contacts.name} · {deal.crm_contacts.company}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[color:var(--pr)] text-xs font-medium" dir="ltr">SAR {fmt(deal.value)}</span>
                        {deal.probability > 0 && (
                          <span className="text-[color:var(--tx-4)] text-xs">{deal.probability}%</span>
                        )}
                      </div>
                      {deal.expected_close_date && (
                        <p className="text-[color:var(--tx-4)] text-xs mt-1">Close: {deal.expected_close_date}</p>
                      )}
                    </GlassCard>
                  </Link>
                ))}

                {!col.deals.length && (
                  <div className="rounded-lg border border-[color:var(--bd)] border-dashed p-4 text-center">
                    <p className="text-[color:var(--tx-4)] text-xs">No deals in this stage</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
