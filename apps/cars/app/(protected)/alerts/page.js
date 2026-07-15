'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { useLanguage } from '@/lib/i18n';
import { GlassPage, GlassButton, GlassEmptyState, GlassLoader, GlassIconTile } from '@/components/glass';

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
      <GlassPage title={t('nav.alerts')}>
        {error && <div className="text-[#F87171] text-sm">{error}</div>}
        {!alerts ? (
          <GlassLoader label={t('common.loading')} />
        ) : alerts.length === 0 ? (
          <div className="glass-card !rounded-[24px]"><GlassEmptyState text={t('dash.noAlertsYet')} icon="✓" /></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {alerts.map(a => (
              <div key={a.id}
                className={'glass-card !rounded-[22px] p-4 flex items-start gap-3.5 transition-opacity ' + (a.is_read ? 'opacity-55' : '')}>
                <GlassIconTile icon="bell" tone={a.is_read ? 'slate' : 'red'} size={11} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-[var(--tx)]">
                    {a.title}{a.cars?.vehicle_number && <span className="text-[var(--tx-4)] font-normal"> — {a.cars.vehicle_number}</span>}
                  </div>
                  <div className="text-xs text-[var(--tx-3)] mt-1">{a.body}</div>
                  <div className="text-[11px] text-[var(--tx-4)] mt-1.5">{formatDateTime(a.created_at)}</div>
                </div>
                {isAdmin && !a.is_read && (
                  <GlassButton variant="ghost" onClick={() => markRead(a.id)} className="!px-3 !py-1 shrink-0">{t('alerts.markRead')}</GlassButton>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassPage>
    </Shell>
  );
}
