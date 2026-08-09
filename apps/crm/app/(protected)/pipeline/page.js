'use client';

import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge } from '@/components/glass';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 0 }); }

const STAGE_COLORS = {
  'Prospecting': 'text-slate-400',
  'Qualification': 'text-blue-400',
  'Proposal': 'text-yellow-400',
  'Negotiation': 'text-orange-400',
  'Closed Won': 'text-emerald-400',
  'Closed Lost': 'text-rose-400',
};

export default function PipelinePage() {
  const { data, loading } = useLiveData('/api/pipeline', 20000);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Sales Pipeline</h1>
        {data && (
          <div className="text-sm text-slate-400">
            <span className="text-white font-medium">{data.total_open}</span> open deals ·{' '}
            <span className="text-cyan-400 font-medium">SAR {fmt(data.total_value)}</span> total value
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="text-center text-slate-400 py-12">Loading pipeline…</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {(data?.pipeline || []).map(col => (
            <div key={col.stage} className="flex-shrink-0 w-64">
              <div className="mb-2 flex items-center justify-between">
                <h3 className={`text-xs font-semibold uppercase tracking-wide ${STAGE_COLORS[col.stage] || 'text-slate-400'}`}>
                  {col.stage}
                </h3>
                <span className="text-xs text-slate-500">{col.count} · SAR {fmt(col.total_value)}</span>
              </div>

              <div className="space-y-2">
                {col.deals.map(deal => (
                  <Link key={deal.id} href={`/deals/${deal.id}`}>
                    <GlassCard className="hover:ring-1 hover:ring-cyan-500/50 transition-all cursor-pointer">
                      <p className="text-white text-sm font-medium">{deal.title}</p>
                      {deal.crm_contacts && (
                        <p className="text-slate-400 text-xs mt-1">{deal.crm_contacts.name} · {deal.crm_contacts.company}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-cyan-400 text-xs font-medium">SAR {fmt(deal.value)}</span>
                        {deal.probability > 0 && (
                          <span className="text-slate-500 text-xs">{deal.probability}%</span>
                        )}
                      </div>
                      {deal.expected_close_date && (
                        <p className="text-slate-500 text-xs mt-1">Close: {deal.expected_close_date}</p>
                      )}
                    </GlassCard>
                  </Link>
                ))}

                {!col.deals.length && (
                  <div className="rounded-lg border border-white/5 border-dashed p-4 text-center">
                    <p className="text-slate-600 text-xs">No deals</p>
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
