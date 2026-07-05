'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';

const STATUS_BADGE = {
  Healthy: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Upcoming: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Overdue: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function MaintenancePage() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/cars/api/maintenance', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(new Error(d.error))))
      .then(d => setItems(d.items))
      .catch(e => setError(e.message));
  }, []);

  return (
    <Shell active="/maintenance">
      <h2 className="text-lg font-semibold mb-1">Maintenance Schedule</h2>
      <p className="text-xs text-slate-500 mb-4">Status is computed live from each vehicle's current odometer reading.</p>
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10">
            <tr><th className="py-3 px-4">Vehicle</th><th>Type</th><th>Last Service (km)</th><th>Interval (km)</th><th>Next Due (km)</th><th>Remaining</th><th>Status</th></tr>
          </thead>
          <tbody>
            {!items ? (
              <tr><td colSpan={7} className="py-8 text-center text-slate-400">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-slate-400">No maintenance items yet.</td></tr>
            ) : items.map(m => (
              <tr key={m.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-3 px-4 font-medium">{m.vehicle_number}</td>
                <td>{m.maintenance_type}</td>
                <td>{fmt(m.last_service_km)}</td>
                <td>{fmt(m.interval_km)}</td>
                <td>{fmt(m.next_due_km)}</td>
                <td className={m.remaining_km < 0 ? 'text-red-500' : ''}>{fmt(m.remaining_km)} km</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (STATUS_BADGE[m.status] || '')}>{m.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
function fmt(n) { return Number(n || 0).toLocaleString(); }
