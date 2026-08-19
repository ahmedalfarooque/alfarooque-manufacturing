'use client';

import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassBadge, GlassButton, GlassCard } from '@/components/glass';

export default function ErpIntegrationPage() {
  const { data, loading } = useLiveData('/api/integrations', 20000);
  const erp = (data?.integrations || []).find(item => item.integration_key === 'alfarooque_erp');
  if (loading && !erp) return <div className="py-12 text-center text-[color:var(--tx-3)]">Loading ERP health…</div>;
  if (!erp) return <div className="space-y-4"><p className="text-red-400">AL FAROOQUE ERP integration is unavailable.</p><Link href="/integrations"><GlassButton variant="secondary">Back</GlassButton></Link></div>;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Link href="/integrations" className="text-xs text-[color:var(--pr)]">← Integration Center</Link><h1 className="mt-2 text-2xl font-bold text-[color:var(--tx)]">AL FAROOQUE ERP</h1><p className="text-sm text-[color:var(--tx-3)]">One internal integration · six separate ERP applications</p></div><GlassBadge tone={erp.status === 'connected' ? 'emerald' : 'red'}>{erp.status.toUpperCase()}</GlassBadge></div>
    <GlassCard className="p-5"><h2 className="font-semibold text-[color:var(--tx)]">ERP Connection</h2><dl className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm"><div><dt className="text-[color:var(--tx-4)]">Authentication</dt><dd className="mt-1 text-[color:var(--tx-2)]">Central ERP authentication</dd></div><div><dt className="text-[color:var(--tx-4)]">Integration layer</dt><dd className="mt-1 text-[color:var(--tx-2)]">Central ERP integration layer</dd></div><div><dt className="text-[color:var(--tx-4)]">API status</dt><dd className="mt-1 text-[color:var(--tx-2)]">{erp.status === 'connected' ? 'Available' : 'Error'}</dd></div><div><dt className="text-[color:var(--tx-4)]">Last synchronization</dt><dd className="mt-1 text-[color:var(--tx-2)]">{erp.last_sync_at ? new Date(erp.last_sync_at).toLocaleString() : 'Direct shared data access'}</dd></div></dl></GlassCard>
    <div className="grid md:grid-cols-2 gap-4">{(erp.modules || []).map(module => <GlassCard key={module.key} className="p-5"><div className="flex items-start justify-between"><div><h2 className="font-bold text-[color:var(--tx)]">{module.name}</h2><p className="mt-1 text-xs text-[color:var(--tx-3)]">Separate application and source of truth</p></div><GlassBadge tone={module.status === 'connected' ? 'emerald' : 'red'}>{module.health}</GlassBadge></div><dl className="mt-5 grid grid-cols-3 gap-3 text-sm"><div><dt className="text-[color:var(--tx-4)]">Status</dt><dd className="mt-1 text-[color:var(--tx-2)]">{module.status}</dd></div><div><dt className="text-[color:var(--tx-4)]">Records</dt><dd className="mt-1 text-[color:var(--tx-2)]">{module.records ?? 'Unavailable'}</dd></div><div><dt className="text-[color:var(--tx-4)]">Last sync</dt><dd className="mt-1 text-[color:var(--tx-2)]">Direct</dd></div></dl>{module.error && <p className="mt-3 text-xs text-red-400">{module.error}</p>}</GlassCard>)}</div>
  </div>;
}
