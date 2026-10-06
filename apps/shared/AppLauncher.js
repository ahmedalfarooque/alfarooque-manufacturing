'use client';

/* Application launcher — shown after sign-in when a user may enter more
   than one ERP application, and as the "no access" landing page.
   Identical across all six apps; each app passes its own registry
   (`apps` + `getAppUrl` from lib/appLinks.js) and its own id.

   The list comes from /api/app-permissions (server-authoritative, same
   app_permissions rows the admin Users page edits) — never from local
   storage or a hard-coded list. Hiding here is navigation only; every app
   enforces access at sign-in, in middleware and in its API routes. */

import { useEffect, useState } from 'react';
import { APP_LABELS } from './appAccess';

const STRINGS = {
  en: {
    welcome: 'Welcome, {name}', choose: 'Choose an application', open: 'Open', current: 'This application',
    none: 'No applications have been assigned to your account.', noneHint: 'Ask an administrator to grant you access, then sign in again.',
    notGranted: 'Your account does not have access to {app}.', yours: 'Applications you can use:',
    loading: 'Loading your applications…', signOut: 'Sign out', error: 'Could not load your applications. Please try again.',
  },
  ar: {
    welcome: 'مرحبًا، {name}', choose: 'اختر تطبيقًا', open: 'فتح', current: 'هذا التطبيق',
    none: 'لم يتم تعيين أي تطبيق لحسابك.', noneHint: 'اطلب من المسؤول منحك الوصول ثم سجّل الدخول مرة أخرى.',
    notGranted: 'حسابك لا يملك صلاحية الوصول إلى {app}.', yours: 'التطبيقات المتاحة لك:',
    loading: 'جارٍ تحميل تطبيقاتك…', signOut: 'تسجيل الخروج', error: 'تعذر تحميل تطبيقاتك. حاول مرة أخرى.',
  },
};

const ICONS = { quotation: 'Q', projects: 'P', cars: 'C', inventory: 'I', accounting: 'A', crm: 'R' };

export default function AppLauncher({ selfId, apps, getAppUrl, lang = 'en', dashboardPath = '/dashboard', loginPath = '/login', notice = null, autoOpenSingle = true }) {
  const s = STRINGS[lang === 'ar' ? 'ar' : 'en'];
  const tr = (k, vars) => { let str = s[k] || k; if (vars) for (const v of Object.keys(vars)) str = str.replace(`{${v}}`, vars[v]); return str; };
  const [user, setUser] = useState(null);
  const [permitted, setPermitted] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, p] = await Promise.all([
          fetch('/api/auth', { credentials: 'same-origin' }),
          fetch('/api/app-permissions', { credentials: 'same-origin' }),
        ]);
        if (a.status === 401 || p.status === 401) { window.location.href = loginPath; return; }
        const ab = await a.json().catch(() => ({}));
        const pb = await p.json().catch(() => ({}));
        if (cancelled) return;
        if (!a.ok || !p.ok) { setError(tr('error')); setPermitted([]); return; }
        setUser(ab.user || null);
        setPermitted(Array.isArray(pb.apps) ? pb.apps : []);
      } catch (_) { if (!cancelled) { setError(tr('error')); setPermitted([]); } }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allowed = permitted ? apps.filter(a => permitted.includes(a.id)) : [];
  const urlFor = a => (a.id === selfId ? dashboardPath : getAppUrl(a.id));

  /* Exactly one application and nothing to explain → go straight there. */
  useEffect(() => {
    if (!permitted || notice || !autoOpenSingle) return;
    if (allowed.length === 1) window.location.replace(urlFor(allowed[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permitted]);

  async function signOut() {
    try { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'logout' }) }); } catch (_) {}
    window.location.href = loginPath;
  }

  const name = user ? (user.full_name || user.email) : '';
  return (
    <main dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen flex items-center justify-center p-4 sm:p-6 text-[color:var(--tx)]">
      <div className="w-full max-w-3xl rounded-2xl border border-[color:var(--bd)] bg-[color:var(--bg-card)] p-5 sm:p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            {user && <h1 className="text-xl sm:text-2xl font-semibold">{tr('welcome', { name })}</h1>}
            <p className="text-sm text-[color:var(--tx-3)] mt-1">{permitted === null ? tr('loading') : allowed.length > 0 ? tr('choose') : ''}</p>
          </div>
          <button type="button" onClick={signOut} className="rounded-xl border border-[color:var(--bd)] px-3 py-1.5 text-sm hover:bg-cyan-500/10 whitespace-nowrap">{tr('signOut')}</button>
        </div>

        {notice === 'app_not_granted' && (
          <div role="alert" className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">{tr('notGranted', { app: APP_LABELS[selfId] || selfId })}</div>
        )}
        {error && <div role="alert" className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>}

        {permitted !== null && allowed.length === 0 && !error && (
          <div role="status" className="rounded-xl border border-[color:var(--bd)] px-4 py-6 text-center">
            <div className="font-medium">{tr('none')}</div>
            <div className="text-sm text-[color:var(--tx-3)] mt-1">{tr('noneHint')}</div>
          </div>
        )}

        {allowed.length > 0 && (
          <>
            {notice && <div className="text-xs uppercase tracking-wider text-[color:var(--tx-3)] mb-2">{tr('yours')}</div>}
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={tr('choose')}>
              {allowed.map(a => (
                <li key={a.id}>
                  <a href={urlFor(a)} className="group flex items-center gap-3 rounded-2xl border border-[color:var(--bd)] px-4 py-4 hover:border-cyan-500/60 hover:bg-cyan-500/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500">
                    <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-600 text-white text-lg font-bold">{ICONS[a.id] || a.id.slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0">
                      <span className="block font-semibold truncate">{APP_LABELS[a.id] || a.id}</span>
                      <span className="block text-xs text-[color:var(--tx-3)]">{a.id === selfId ? tr('current') : tr('open')}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
