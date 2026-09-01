'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { GlassIcon } from '@/components/GlassIcons';
import AppSwitcherButtons from '@/components/AppSwitcherButtons';
import { GlassToastHost } from '@/components/glass';
import { readPref, writePref, THEME_PREF_COOKIE } from '@/lib/prefs';
import ModuleActionVisibility from '../../shared/ModuleActionVisibility';

const NAV = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard' },
  { href: '/projects', labelKey: 'nav.projects', icon: 'folder' },
  { href: '/sales-orders', labelKey: 'nav.salesOrders', icon: 'truck', adminOnly: true },
  { href: '/orders', labelKey: 'nav.orders', icon: 'invoice', adminOnly: true },
  { href: '/orders-deleted', labelKey: 'nav.ordersDeleted', icon: 'invoice', adminOnly: true },
  { href: '/quotes', labelKey: 'nav.quotes', icon: 'quote', adminOnly: true },
  { href: '/quotes-deleted', labelKey: 'nav.quotesDeleted', icon: 'quote', adminOnly: true },
  { href: '/purchase-requests', labelKey: 'nav.purchaseRequests', icon: 'receipt', adminOnly: true },
  { href: '/quotation-requests', labelKey: 'nav.quotationRequests', icon: 'quote', adminOnly: true },
  { href: '/customers', labelKey: 'nav.customers', icon: 'users', hideExternal: true },
  { href: '/users', labelKey: 'nav.users', icon: 'user', adminOnly: true },
];

export default function Shell({ children, active }) {
  const { lang, setLang, t, formatDate } = useLanguage();
  const [user, setUser] = useState(null);
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setUser(d.user))
      .catch(() => {});
    try {
      /* Cross-app pref cookie wins (latest choice made in ANY app);
         the per-app localStorage key stays as the fallback. */
      const saved = readPref(THEME_PREF_COOKIE) || localStorage.getItem('af-projects-theme');
      setDark(saved === 'dark');
    } catch (_) {}
    /* Background SmartLife sync trigger — fire-and-forget, never awaited,
       never blocks render. Same pattern as apps/accounting/components/
       Shell.js: the central sync route (apps/crm/app/api/integrations/
       [key]/sync/route.js) decides whether to actually run (freshness/lock),
       this is just the trigger, once per tab per session. */
    try {
      if (!sessionStorage.getItem('af_smartlife_bg_sync_fired')) {
        sessionStorage.setItem('af_smartlife_bg_sync_fired', '1');
        fetch('/api/smartlife/sync', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin', body: JSON.stringify({ trigger: 'background' }),
        }).catch(() => {});
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    /* Skip identical responses (no re-render on unchanged polls) and
       don't poll hidden tabs — one refresh fires on return instead. */
    let lastRaw = null;
    function loadNotifications() {
      fetch('/api/notifications', { credentials: 'same-origin' })
        .then(r => r.ok ? r.text() : null)
        .then(raw => {
          if (raw === null || raw === lastRaw) return;
          lastRaw = raw;
          let d; try { d = JSON.parse(raw); } catch (_) { return; }
          setNotifications(d.notifications || []);
          setUnread(d.unread || 0);
        })
        .catch(() => {});
    }
    loadNotifications();
    const interval = setInterval(() => { if (!document.hidden) loadNotifications(); }, 20000);
    const onVisible = () => { if (!document.hidden) loadNotifications(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  async function markRead(id, link) {
    await fetch(`/api/notifications/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ is_read: true }),
    }).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
    setNotifOpen(false);
    if (link) window.location.href = link;
  }

  /* Inline Accept/Hold/Reject directly on a quotation_request notification
     (Part 5) — extracts the request id from the notification's own link
     (/quotation-requests/{id}) rather than a second lookup round-trip. */
  async function actOnQuotationRequest(e, n, status) {
    e.stopPropagation();
    const id = (n.link || '').split('/').filter(Boolean).pop();
    if (!id) return;
    await fetch(`/api/quotation-requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ status }),
    }).catch(() => {});
    await fetch(`/api/notifications/${n.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ is_read: true }),
    }).catch(() => {});
    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    setUnread(prev => Math.max(0, prev - 1));
  }

  async function deleteNotification(e, id) {
    e.stopPropagation();
    await fetch(`/api/notifications/${id}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => {});
    const wasUnread = notifications.some(n => n.id === id && !n.is_read);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (wasUnread) setUnread(u => Math.max(0, u - 1));
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('af-projects-theme', next ? 'dark' : 'light'); } catch (_) {}
    writePref(THEME_PREF_COOKIE, next ? 'dark' : 'light');
  }

  async function logout() {
    try { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'logout' }) }); } catch (_) {}
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen flex text-[color:var(--tx)]">
      <ModuleActionVisibility />
      <aside className={
        'print:hidden fixed lg:static z-40 inset-y-0 start-0 w-64 shrink-0 flex flex-col transition-transform af-sidebar ' +
        'bg-[color:var(--sidebar-bg)] border-e border-[color:var(--sidebar-border)] ' +
        'shadow-[8px_0_40px_rgba(11,27,41,0.06)] dark:shadow-[8px_0_40px_rgba(0,0,0,0.4)] ' +
        (sidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:!translate-x-0')
      }>
        <div className="flex items-center gap-3 px-5 h-16 border-b border-[color:var(--sidebar-border)]">
          <span className="icon-tile icon-tile--sm !p-0 overflow-hidden">
            <img src="/logo.png" alt="AL FAROOQUE" className="h-6 w-6 object-contain" />
          </span>
          <div>
            <div className="font-semibold text-sm leading-tight text-[color:var(--sidebar-active-text)]">{t('shell.appName')}</div>
            <div className="text-[11px] text-[color:var(--sidebar-text-muted)]">{t('shell.appTagline')}</div>
          </div>
        </div>
        <a href="/dashboard" className="mx-3 mt-3 flex items-center gap-2.5 rounded-xl px-3 py-2.5 border border-[color:var(--sidebar-border)] bg-[color:var(--sidebar-hover-bg)] hover:border-[rgba(37,99,235,0.35)] hover:bg-[rgba(255,255,255,0.08)] transition-colors">
          <span className="h-8 w-8 rounded-full grid place-items-center text-xs font-semibold text-[color:var(--sidebar-active-text)] bg-[color:var(--sidebar-active-bg)] border border-[rgba(37,99,235,0.3)]">
            {(user?.full_name || user?.email || '?').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="text-sm truncate text-[color:var(--sidebar-text)]">{user?.full_name || t('shell.loading')}</div>
            <div className="text-[11px] text-[color:var(--sidebar-text-muted)] truncate">{user?.role ? t('role.' + user.role) : ''}</div>
          </div>
        </a>
        <nav className="flex-1 px-3 space-y-1 mt-3 overflow-y-auto">
          {NAV.filter(item => (!item.adminOnly || user?.role === 'admin') && (!item.hideExternal || user?.role !== 'external')).map(item => (
            <a key={item.href} href={item.href}
              className={
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ' +
                (active === item.href
                  ? 'nav-active bg-[color:var(--sidebar-active-bg)] text-[color:var(--sidebar-active-text)]'
                  : 'text-[color:var(--sidebar-text)] hover:bg-[color:var(--sidebar-hover-bg)] hover:text-[color:var(--sidebar-active-text)]')
              }>
              <GlassIcon name={item.icon} size={21} className="shrink-0" bare />{t(item.labelKey)}
            </a>
          ))}
        </nav>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="af-topbar print:hidden min-h-16 flex flex-wrap items-center justify-between gap-y-2 py-2 lg:h-16 lg:py-0 px-3 sm:px-4 lg:px-6 border-b border-[color:var(--sidebar-border)] bg-[color:var(--sidebar-bg)] sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden glass-ctrl gbtn--icon" onClick={() => setSidebarOpen(true)} aria-label="Menu">☰</button>
            <h1 className="font-semibold text-lg capitalize truncate text-[color:var(--sidebar-text)]">{(() => { const navItem = NAV.find(i => i.href === active); return navItem ? t(navItem.labelKey) : active.replace('/', ''); })()}</h1>
          </div>
          <div className="flex items-center flex-wrap justify-end gap-2 sm:gap-3">
            <AppSwitcherButtons user={user} />
            <div className="relative">
              <button onClick={() => setNotifOpen(o => !o)} className="relative glass-ctrl !p-0 !w-9 !h-9" aria-label={t('shell.notifications')}>
                <GlassIcon name="bell" size={18} />
                {unread > 0 && <span className="absolute -top-1 -end-1 h-4 min-w-4 px-1 rounded-full bg-[#ef4444] text-white text-[10px] leading-4 text-center font-semibold">{unread > 9 ? '9+' : unread}</span>}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div className="glass-card absolute end-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] max-h-[70vh] overflow-y-auto z-40">
                    <div className="px-4 py-3 border-b border-[color:var(--bd)] font-semibold text-sm">{t('shell.notifications')}</div>
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-[color:var(--tx-4)]">{t('shell.noNotificationsYet')}</div>
                    ) : notifications.map(n => (
                      <div key={n.id}
                        className={'w-full text-start px-4 py-3 border-b border-[color:var(--bd)] hover:bg-[color:var(--pr-soft)] transition-colors duration-200 ' + (n.is_read ? 'opacity-60' : '')}>
                        <button onClick={() => markRead(n.id, n.link)} className="w-full text-start">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{n.title}</span>
                            {!n.is_read && <span className="h-2 w-2 rounded-full bg-[color:var(--pr)] shrink-0" />}
                          </div>
                          {n.body && <div className="text-xs text-[color:var(--tx-3)] whitespace-pre-line">{n.body}</div>}
                          <div className="text-[11px] text-[color:var(--tx-4)] mt-0.5">{formatDate(n.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</div>
                        </button>
                        <button onClick={(e) => deleteNotification(e, n.id)} className="text-[11px] text-[color:var(--tx-4)] hover:text-[#ef4444] mt-1">{t('common.delete')}</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="glass-ctrl lang-toggle-btn" aria-label={t('shell.toggleLanguage')}>
              <span className="ctrl-label">{lang === 'ar' ? 'EN' : 'عربي'}</span>
            </button>
            <button onClick={toggleTheme} className="glass-ctrl" aria-label={t('shell.toggleTheme')} aria-pressed={dark}>
              <GlassIcon name={dark ? 'sun' : 'moon'} size={16} className="ctrl-icon" />
            </button>
            <button onClick={logout} className="glass-ctrl">
              <GlassIcon name="logout" size={16} className="ctrl-icon" />
              <span className="ctrl-label">{t('shell.logout')}</span>
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 min-w-0"><div className="max-w-[1800px] mx-auto gfade-up">{children}</div></main>
      </div>
      <GlassToastHost />
    </div>
  );
}
