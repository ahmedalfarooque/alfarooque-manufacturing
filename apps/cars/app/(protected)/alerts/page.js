'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { useLanguage } from '@/lib/i18n';
import { EmptyState } from '@/components/ui';

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
      {error && <div className="text-[#BC6B4E] text-sm">{error}</div>}
      {!alerts ? (
        <div className="text-[#8C8A80] text-sm">{t('common.loading')}</div>
      ) : alerts.length === 0 ? (
        <div className="glass-card glass-card--pad">
          <EmptyState text={t('dash.noAlertsYet')} />
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(a => (
            <div key={a.id} className={a.is_read
              ? 'glass-card glass-card--pad flex items-start justify-between gap-3 opacity-60'
              : 'rounded-2xl border border-[#BC6B4E]/30 bg-[#BC6B4E]/5 p-4 flex items-start justify-between gap-3'}>
              <div>
                <div className="font-medium text-sm">{a.title} {a.cars?.vehicle_number && <span className="text-[#8C8A80]">— {a.cars.vehicle_number}</span>}</div>
                <div className="text-xs text-[#8C8A80] mt-1">{a.body}</div>
                <div className="text-[11px] text-[#8C8A80]/80 mt-1">{formatDateTime(a.created_at)}</div>
              </div>
              {isAdmin && !a.is_read && <button onClick={() => markRead(a.id)} className="text-xs px-2 py-1 rounded-lg border border-[#E5E2DD] dark:border-white/[0.08] hover:bg-[#F1EEE7] dark:hover:bg-white/5 transition-colors shrink-0">{t('alerts.markRead')}</button>}
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
