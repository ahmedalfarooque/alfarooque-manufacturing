'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { APPS, getAppUrl } from '@/lib/appLinks';

/* Application Switcher — visible to every authenticated user, not just
   admins. Shows exactly the apps the user has permission for (via
   /api/app-permissions, backed by the shared app_permissions table).
   Admins and the super-admin account always see every app. Mirrored
   across all 6 apps (identical file except SELF_ID). */
const SELF_ID = 'accounting';

const LABELS = {
  en: { quotation: 'QuotePro', projects: 'Projects', cars: 'Cars', inventory: 'Inventory', accounting: 'Accounting', crm: 'CRM' },
  ar: { quotation: 'QuotePro', projects: 'المشاريع', cars: 'السيارات', inventory: 'المستودع', accounting: 'المحاسبة', crm: 'إدارة العملاء' },
};

export default function AppSwitcherButtons({ user }) {
  const { lang } = useLanguage();
  const [activeApp, setActiveApp] = useState(null);
  const [busy, setBusy] = useState(null);
  const [permitted, setPermitted] = useState(null);

  useEffect(() => {
    try {
      const origin = window.location.origin;
      const match = APPS.find(a => getAppUrl(a.id) === origin);
      if (match) setActiveApp(match.id);
    } catch (_) {}
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/app-permissions', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setPermitted(d ? d.apps : []))
      .catch(() => setPermitted([]));
  }, [user]);

  if (!user || !permitted) return null;

  const L = LABELS[lang] || LABELS.en;
  const order = APPS.map(a => a.id).filter(id => id !== SELF_ID && permitted.includes(id));
  if (order.length === 0) return null;

  function go(id) {
    if (id === activeApp || busy) return;
    const url = getAppUrl(id);
    if (!url) return;
    setBusy(id);
    window.location.assign(url + '/dashboard');
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Applications">
      {order.map(id => {
        const isActive = id === activeApp;
        return (
          <button key={id} type="button" onClick={() => go(id)} disabled={busy === id}
            aria-current={isActive ? 'page' : undefined} title={L[id]}
            className={'glass-ctrl app-switch-btn' + (isActive ? ' !bg-[color:var(--pr-soft)] !text-[color:var(--pr)] !border-[rgba(6,182,212,0.4)]' : '')}>
            <span className="ctrl-label whitespace-nowrap">{L[id]}{busy === id ? '…' : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
