'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';

const STATUS_BADGE = {
  Healthy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Upcoming: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Overdue: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function MaintenanceSchedulePage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [me, setMe] = useState(null);
  const [modal, setModal] = useState(null);
  const isAdmin = me?.role === 'admin';

  function load() {
    fetch('/api/maintenance', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(new Error(d.error))))
      .then(d => setItems(d.items))
      .catch(e => setError(e.message));
  }
  useEffect(load, []);
  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);

  async function saveItem(form, id) {
    const res = await fetch(`/api/maintenance/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setModal(null);
    load();
  }

  async function deleteItem(id) {
    if (!confirm('Delete this schedule item? This cannot be undone.')) return;
    const res = await fetch(`/api/maintenance/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) load();
  }

  return (
    <Shell active="/maintenance-schedule">
      <h2 className="text-lg font-semibold mb-1">Maintenance Schedule</h2>
      <p className="text-xs text-slate-500 mb-4">Status is computed live from each vehicle's current odometer reading.</p>
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-16 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th className="py-3 px-4">Vehicle</th><th>Type</th><th>Last Service (km)</th><th>Interval (km)</th><th>Next Due (km)</th><th>Remaining</th><th>Status</th>
              {isAdmin && <th className="text-right px-4">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {!items ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">No maintenance items yet.</td></tr>
            ) : items.map(m => (
              <tr key={m.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-3 px-4 font-medium">{m.vehicle_number}</td>
                <td>{m.maintenance_type}</td>
                <td>{fmt(m.last_service_km)}</td>
                <td>{fmt(m.interval_km)}</td>
                <td>{fmt(m.next_due_km)}</td>
                <td className={m.remaining_km < 0 ? 'text-red-500' : ''}>{fmt(m.remaining_km)} km</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (STATUS_BADGE[m.status] || '')}>{m.status}</span></td>
                {isAdmin && (
                  <td className="text-right px-4 space-x-2">
                    <button onClick={() => setModal(m)} title="Edit Schedule" className="text-brand-500">✎ Edit</button>
                    <button onClick={() => deleteItem(m.id)} title="Delete Schedule" className="text-red-500">🗑 Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <ScheduleModal item={modal} onClose={() => setModal(null)} onSave={saveItem} />}
    </Shell>
  );
}

function ScheduleModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    maintenance_type: item.maintenance_type || '',
    last_service_km: item.last_service_km ?? '',
    interval_km: item.interval_km ?? '',
    notes: item.notes || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await onSave(form, item.id); }
    catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4">
        <h3 className="font-semibold text-lg">Edit Schedule — {item.vehicle_number}</h3>
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Maintenance Type</label>
            <input value={form.maintenance_type} onChange={set('maintenance_type')} required className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Last Service (km)</label>
            <input type="number" value={form.last_service_km} onChange={set('last_service_km')} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Interval (km)</label>
            <input type="number" value={form.interval_km} onChange={set('interval_km')} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Notes</label>
            <textarea value={form.notes} onChange={set('notes')} rows={2} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm">Cancel</button>
          <button disabled={busy} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function fmt(n) { return Number(n || 0).toLocaleString(); }
