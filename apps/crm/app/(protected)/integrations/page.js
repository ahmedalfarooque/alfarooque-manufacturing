'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassBadge, GlassButton, GlassCard, GlassField, GlassInput, GlassModal, GlassSelect, toast } from '@/components/glass';

const statusTone = status => status === 'connected' ? 'emerald' : status === 'error' ? 'red' : status === 'warning' ? 'amber' : 'slate';
const formatTime = value => value ? new Date(value).toLocaleString() : 'Never';

export default function IntegrationsPage() {
  const { data, loading, refresh } = useLiveData('/api/integrations', 20000);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState('');

  async function run(key, action) {
    setBusy(`${key}:${action}`);
    try {
      const response = await fetch(`/api/integrations/${key}/${action}`, { method: 'POST' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Request failed.');
      toast(action === 'test' ? 'Connection verified' : `Synchronization complete: ${body.records} records`, 'emerald');
      refresh();
    } catch (error) { toast(error.message, 'red'); }
    finally { setBusy(''); }
  }

  function configure(item) {
    setEditing(item);
    setForm({ enabled: item.enabled, sync_frequency_minutes: item.sync_frequency_minutes || 60 });
  }

  async function save() {
    setBusy('save');
    try {
      const response = await fetch(`/api/integrations/${editing.integration_key}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Save failed.');
      toast('Integration configuration saved securely', 'emerald');
      setEditing(null); refresh();
    } catch (error) { toast(error.message, 'red'); }
    finally { setBusy(''); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-[color:var(--tx)]">Integration Center</h1><p className="text-sm text-[color:var(--tx-3)]">One governed connection layer for CRM and ERP applications</p></div>
      <div className="flex gap-2"><GlassBadge tone="amber">Pending {data?.pending || 0}</GlassBadge><GlassBadge tone="red">Failed {data?.failed || 0}</GlassBadge><GlassBadge tone="violet">Conflicts {data?.conflicts || 0}</GlassBadge></div>
    </div>
    {loading && !data ? <div className="py-12 text-center text-[color:var(--tx-3)]">Loading integration health…</div> :
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{(data?.integrations || []).map(item => <GlassCard key={item.id} className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-[color:var(--tx)]">{item.name}</h2><p className="text-xs text-[color:var(--tx-3)]">{item.provider} · {item.integration_type}</p></div><GlassBadge tone={statusTone(item.status)}>{item.status.replaceAll('_',' ').toUpperCase()}</GlassBadge></div>
        <dl className="grid grid-cols-2 gap-3 text-xs"><div><dt className="text-[color:var(--tx-4)]">Last sync</dt><dd className="mt-1 text-[color:var(--tx-2)]">{formatTime(item.last_sync_at)}</dd></div><div><dt className="text-[color:var(--tx-4)]">Direction</dt><dd className="mt-1 text-[color:var(--tx-2)] capitalize">{item.sync_direction}</dd></div><div><dt className="text-[color:var(--tx-4)]">Last run</dt><dd className="mt-1 text-[color:var(--tx-2)]">{item.latestRun?.status || 'None'}</dd></div><div><dt className="text-[color:var(--tx-4)]">Conflicts</dt><dd className="mt-1 text-[color:var(--tx-2)]">{item.openConflicts}</dd></div></dl>
        {item.integration_key === 'alfarooque_erp' && <div className="rounded-xl border border-[color:var(--bd)] p-3"><p className="mb-2 text-xs font-semibold text-[color:var(--tx-3)]">Internal ERP applications</p><div className="grid grid-cols-2 gap-2">{(item.modules || []).map(module => <div key={module.key} className="flex items-center gap-2 text-xs text-[color:var(--tx-2)]"><span className={module.status === 'connected' ? 'text-emerald-400' : 'text-red-400'}>{module.status === 'connected' ? '✓' : '!'}</span>{module.name}</div>)}</div></div>}
        {item.last_error && <p className="rounded-lg bg-red-500/10 p-2 text-xs text-red-400">{item.last_error}</p>}
        <div className="flex flex-wrap gap-2"><GlassButton size="sm" variant="secondary" onClick={() => run(item.integration_key,'test')} disabled={!!busy || !['smartlife','alfarooque_erp'].includes(item.integration_key)}>Test connection</GlassButton><GlassButton size="sm" onClick={() => run(item.integration_key,'sync')} disabled={!!busy || item.integration_key !== 'smartlife'}>Sync now</GlassButton>{item.integration_key === 'alfarooque_erp' && <Link href="/integrations/alfarooque_erp"><GlassButton size="sm" variant="secondary">View details</GlassButton></Link>}{item.integration_key === 'smartlife' && <GlassButton size="sm" variant="secondary" onClick={() => configure(item)}>Configure</GlassButton>}</div>
      </GlassCard>)}</div>}
    {editing && <GlassModal title="SmartERP Integration" onClose={() => setEditing(null)} footer={<div className="flex justify-end gap-2"><GlassButton variant="secondary" onClick={() => setEditing(null)}>Cancel</GlassButton><GlassButton onClick={save} disabled={busy === 'save'}>{busy === 'save' ? 'Saving…' : 'Save'}</GlassButton></div>}>
      <div className="grid md:grid-cols-2 gap-4"><GlassField label="Connection"><GlassInput value="Server-managed central SmartERP API" readOnly /></GlassField><GlassField label="Status"><GlassSelect value={form.enabled ? 'enabled' : 'disabled'} onChange={e => setForm(f => ({...f,enabled:e.target.value === 'enabled'}))}><option value="enabled">Enabled</option><option value="disabled">Disabled</option></GlassSelect></GlassField><GlassField label="Sync interval (minutes)"><GlassInput type="number" min="5" value={form.sync_frequency_minutes || 60} onChange={e => setForm(f => ({...f,sync_frequency_minutes:e.target.value}))} /></GlassField><GlassField label="Credentials"><GlassInput value={editing.config?.serverConfigured ? 'Configured securely' : 'Not configured'} readOnly /></GlassField></div>
      <p className="mt-4 text-xs text-[color:var(--tx-3)]">Authentication is configured once in the server environment. Credentials and tokens are never returned to the browser. All current SmartERP access is read-only.</p>
      <div className="mt-4 rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-300" role="alert"><strong className="block text-red-200">Future SmartERP write protection</strong><span className="mt-1 block">Any future create, edit, or delete action must show a separate RED warning with the exact target, record, and action, then obtain explicit authorization before execution and audit the result.</span></div>
    </GlassModal>}
  </div>;
}
