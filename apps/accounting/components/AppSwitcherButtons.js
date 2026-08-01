'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { APPS, getAppUrl } from '@/lib/appLinks';

const LABELS = {
  en: { quotation: 'QuotePro', projects: 'Projects', cars: 'Cars', inventory: 'Inventory', accounting: 'Accounting', crm: 'CRM' },
  ar: { quotation: 'QuotePro', projects: 'المشاريع', cars: 'السيارات', inventory: 'المستودع', accounting: 'المحاسبة', crm: 'إدارة العملاء' },
};
const ORDER = ['quotation', 'projects', 'cars', 'inventory', 'crm'];

export default function AppSwitcherButtons({ user }) {
  const { lang } = useLanguage();
  const [activeApp, setActiveApp] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    try {
      const origin = window.location.origin;
      const match = APPS.find(a => getAppUrl(a.id) === origin);
      if (match) setActiveApp(match.id);
    } catch (_) {}
  }, []);

  if (user?.role !== 'admin') return null;

  const L = LABELS[lang] || LABELS.en;

  function go(id) {
    if (id === activeApp || busy) return;
    const url = getAppUrl(id);
    if (!url) return;
    setBusy(id);
    window.location.assign(url + '/dashboard');
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Applications">
      {ORDER.map(id => {
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
