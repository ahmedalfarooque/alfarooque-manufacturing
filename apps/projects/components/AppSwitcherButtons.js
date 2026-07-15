'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { APPS, getAppUrl } from '@/lib/appLinks';

/* Admin-only ERP module switcher — three individual buttons (no dropdown,
   no menu, no arrows), one per application, rendered in the existing
   header next to the other glass controls. Completely hidden (renders
   nothing, no empty space) for every non-admin role.

   Mirrored file: apps/quotation/components/AppSwitcherButtons.js ·
   apps/projects/components/AppSwitcherButtons.js ·
   apps/cars/components/AppSwitcherButtons.js — the three copies are
   byte-identical (the active app is detected at runtime by comparing the
   current origin against the same URLs the buttons navigate to), so a
   future change means editing this one component and copying it over the
   other two.

   Styling reuses the existing design system: each button is a standard
   .glass-ctrl pill (same height, radius, glass, shadows, hover). The
   active app gets the app's own primary fill (bg-brand-600 resolves per
   app via its tailwind config). The extra .app-switch-btn class only
   keeps the pill + text label on mobile, where the generic .glass-ctrl
   collapses to an icon circle — see globals.css.

   Switching is a plain same-tab navigation — instant, and always
   allowed from any app to any app. The existing SSO cookie signs the
   Admin straight into the sibling app; theme + language follow via the
   shared preference cookies. (An earlier version did a pre-navigation
   reachability "probe" and disabled a button on failure — that produced
   false "temporarily unavailable" states, especially against a sibling
   dev server that was slow on a cold compile, so it was removed. If a
   target app is genuinely offline the browser shows its own error page;
   the switcher never blocks a working app.) */

const LABELS = {
  en: { quotation: 'QuotePro', projects: 'Projects', cars: 'Car Inventory' },
  ar: { quotation: 'QuotePro', projects: 'المشاريع', cars: 'مخزون السيارات' },
};
const ORDER = ['quotation', 'projects', 'cars'];

export default function AppSwitcherButtons({ user }) {
  const { lang } = useLanguage();
  const [activeApp, setActiveApp] = useState(null);
  const [busy, setBusy] = useState(null);

  /* Runs client-side after mount (no SSR/hydration mismatch). Works on
     localhost ports, production subdomains and NEXT_PUBLIC_*_APP_URL
     overrides alike. */
  useEffect(() => {
    try {
      const origin = window.location.origin;
      const match = APPS.find(a => getAppUrl(a.id) === origin);
      if (match) setActiveApp(match.id);
    } catch (_) {}
  }, []);

  /* Admin only — everyone else keeps exactly the current interface. */
  if (user?.role !== 'admin') return null;

  const L = LABELS[lang] || LABELS.en;

  function go(id) {
    if (id === activeApp || busy) return;
    const url = getAppUrl(id);
    if (!url) return;
    setBusy(id);
    /* Same tab, plain navigation — no probe, no gate. */
    window.location.assign(url + '/dashboard');
  }

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Applications">
      {ORDER.map(id => {
        const isActive = id === activeApp;
        return (
          <button
            key={id}
            type="button"
            onClick={() => go(id)}
            disabled={busy === id}
            aria-current={isActive ? 'page' : undefined}
            title={L[id]}
            className={
              'glass-ctrl app-switch-btn' +
              (isActive ? ' !bg-[color:var(--pr-soft)] !text-[color:var(--pr)] !border-[rgba(6,182,212,0.4)]' : '')
            }
          >
            <span className="ctrl-label whitespace-nowrap">
              {L[id]}{busy === id ? '…' : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
