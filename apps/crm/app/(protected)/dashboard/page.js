'use client';

import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge } from '@/components/glass';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

function statusTone(s) { return s === 'Won' ? 'success' : s === 'Lost' ? 'error' : 'info'; }

export default function DashboardPage() {
  const { data, loading } = useLiveData('/api/dashboard', 30000);
  const d = data || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">CRM Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Customer relationship overview</p>
      </div>

      {loading && !data ? (
        <div className="text-center text-slate-400 py-12">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Contacts', value: d.totalContacts ?? '—' },
              { label: 'Pipeline Value', value: `SAR ${fmt(d.pipelineValue)}` },
              { label: 'Won Deals', value: d.wonDeals ?? '—' },
              { label: 'Activities (Month)', value: d.monthActivities ?? '—' },
            ].map(s => (
              <GlassCard key={s.label}>
                <p className="text-xs text-slate-400 mb-1">{s.label}</p>
                <p className="text-2xl font-bold text-white">{s.value}</p>
              </GlassCard>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-300">Recent Contacts</h3>
                <Link href="/contacts" className="text-xs text-cyan-400 hover:text-cyan-300">View all →</Link>
              </div>
              {!(d.recentContacts || []).length ? (
                <p className="text-slate-500 text-sm">No contacts yet.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {(d.recentContacts || []).map(c => (
                    <div key={c.id} className="py-2 flex items-center justify-between text-sm">
                      <div>
                        <Link href={`/contacts/${c.id}`} className="text-white font-medium hover:text-cyan-400">{c.name}</Link>
                        {c.company && <span className="text-slate-400 ml-2">{c.company}</span>}
                      </div>
                      <span className="text-slate-500 text-xs">{c.email || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            <GlassCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-300">Recent Deals</h3>
                <Link href="/deals" className="text-xs text-cyan-400 hover:text-cyan-300">View all →</Link>
              </div>
              {!(d.recentDeals || []).length ? (
                <p className="text-slate-500 text-sm">No deals yet.</p>
              ) : (
                <div className="divide-y divide-white/5">
                  {(d.recentDeals || []).map(deal => (
                    <div key={deal.id} className="py-2 flex items-center justify-between text-sm">
                      <Link href={`/deals/${deal.id}`} className="text-white font-medium hover:text-cyan-400">{deal.title}</Link>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-300">SAR {fmt(deal.value)}</span>
                        <GlassBadge tone={statusTone(deal.status)}>{deal.status}</GlassBadge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
