'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { useLanguage } from '@/lib/i18n';

export default function AlertsPage() {
  const { t, formatDateTime } = useLanguage();
  const [alerts, setAlerts] = useState(null);
  const [error, setError] = useState(null);
  const [me, setMe] = useState(null);
  const isAdmin = me?.role === 'admin';

  function load() {
    fetch('/api/alerts', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(new Error(d.error))))
      .then(d => setAlerts(d.alerts))
      .catch(e => setError(e.message));
  }
  useEffect(load, []);
  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);

  async function markRead(id) {
    await fetch('/api/alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ id }) });
    load();
  }

  return (
    <Shell active="/alerts">
      <h2 className="text-lg font-semibold mb-4">{t('nav.alerts')}</h2>
      {error && <div className="text-red-500 text-sm">{error}</div>}
      {!alerts ? (
        <div className="text-slate-400 text-sm">{t('common.loading')}</div>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-8 text-center text-slate-400 text-sm">{t('dash.noAlertsYet')}</div>
      ) : (
        <div className="space-y-2">
          {alerts.map(a => (
            <div key={a.id} className={'rounded-xl border p-4 flex items-start justify-between gap-3 ' + (a.is_read ? 'border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] opacity-60' : 'border-red-500/30 bg-red-500/5')}>
              <div>
                <div className="font-medium text-sm">{a.title} {a.cars?.vehicle_number && <span className="text-slate-400">— {a.cars.vehicle_number}</span>}</div>
                <div className="text-xs text-slate-500 mt-1">{a.body}</div>
                <div className="text-[11px] text-slate-400 mt-1">{formatDateTime(a.created_at)}</div>
              </div>
              {isAdmin && !a.is_read && <button onClick={() => markRead(a.id)} className="text-xs px-2 py-1 rounded border border-black/10 dark:border-white/10 shrink-0">{t('alerts.markRead')}</button>}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
