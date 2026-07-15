'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { GlassIcon } from '@/components/GlassIcons';
import AppSwitcherButtons from '@/components/AppSwitcherButtons';
import { readPref, writePref, THEME_PREF_COOKIE } from '@/lib/prefs';

const NAV = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: 'dashboard' },
  { href: '/quotations', labelKey: 'nav.quotations', icon: 'receipt' },
  { href: '/customers', labelKey: 'nav.customers', icon: 'users' },
  { href: '/catalogue', labelKey: 'nav.catalogue', icon: 'folder' },
  { href: '/materials', labelKey: 'nav.materials', icon: 'box' },
  { href: '/suppliers', labelKey: 'nav.suppliers', icon: 'truck' },
  { href: '/labour', labelKey: 'nav.labour', icon: 'user' },
  { href: '/machines', labelKey: 'nav.machines', icon: 'wrench' },
  { href: '/expenses', labelKey: 'nav.expenses', icon: 'bag' },
  { href: '/reports', labelKey: 'nav.reports', icon: 'chart' },
  { href: '/users', labelKey: 'nav.users', icon: 'user', adminOnly: true },
  { href: '/settings', labelKey: 'nav.settings', icon: 'gear', adminOnly: true },
  { href: '/audit', labelKey: 'nav.audit', icon: 'shield', adminOnly: true },
];

export default function Shell({ children, active }) {
  const { lang, setLang, t, tr, formatDate } = useLanguage();
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
      const saved = readPref(THEME_PREF_COOKIE) || localStorage.getItem('af-quotation-theme');
      setDark(saved !== 'light');
      if (saved !== 'light') document.documentElement.classList.add('dark');
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
    try { localStorage.setItem('af-quotation-theme', next ? 'dark' : 'light'); } catch (_) {}
    writePref(THEME_PREF_COOKIE, next ? 'dark' : 'light');
  }

  async function logout() {
    try { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'logout' }) }); } catch (_) {}
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen flex text-[#122A30] dark:text-[#F4F9FA] transition-colors duration-300">
      <aside className={
        'af-shell-aside fixed lg:static z-40 inset-y-0 start-0 w-64 shrink-0 bg-white/80 dark:bg-[#0F2A36]/75 backdrop-blur-2xl backdrop-saturate-150 border-e border-[#D9E4E6] dark:border-white/[0.08] text-[#41585C] dark:text-[#9DB3B6] flex flex-col transition-transform ' +
        (sidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:!translate-x-0')
      }>
        <div className="flex items-center gap-3 px-5 h-16 border-b border-[#D9E4E6] dark:border-white/[0.08]">
          <img src="/logo.png" alt="AL FAROOQUE" className="h-9 w-9 object-contain shrink-0" />
          <div>
            <div className="text-[#122A30] dark:text-[#F4F9FA] font-semibold text-sm leading-tight">{t('shell.appName')}</div>
            <div className="text-[11px] text-[#7C9296]">{t('shell.appTagline')}</div>
          </div>
        </div>
        <a href="/profile" className="px-5 py-3 flex items-center gap-2 border-b border-[#D9E4E6] dark:border-white/[0.08] hover:bg-[#E4EDEE] dark:hover:bg-white/5 transition-colors duration-200">
          <div className="h-8 w-8 rounded-full bg-brand-600/15 flex items-center justify-center text-xs font-medium text-brand-700 dark:text-brand-300 shrink-0">
            {(user?.full_name || user?.email || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-[#122A30] dark:text-[#F4F9FA] truncate">{user?.full_name || t('shell.loading')}</div>
            <div className="text-[11px] text-[#7C9296] truncate">{user?.role ? t('role.' + user.role) : ''}</div>
          </div>
        </a>
        <nav className="flex-1 px-3 space-y-1 mt-2 overflow-y-auto">
          {NAV.filter(item => !item.adminOnly || user?.role === 'admin').map(item => (
            <a key={item.href} href={item.href}
              className={
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200 ' +
                (active === item.href ? 'af-nav-active' : 'hover:bg-[#E4EDEE] dark:hover:bg-white/5 text-[#41585C] dark:text-[#9DB3B6]')
              }>
              <GlassIcon name={item.icon} size={20} className="shrink-0" />{t(item.labelKey)}
            </a>
          ))}
        </nav>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="af-shell-header min-h-16 flex flex-wrap items-center justify-between gap-y-2 py-2 lg:h-16 lg:py-0 px-3 sm:px-4 lg:px-6 border-b border-[#D9E4E6] dark:border-white/[0.08] bg-white/75 dark:bg-[#0F2A36]/65 backdrop-blur-2xl backdrop-saturate-150 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden text-xl shrink-0" onClick={() => setSidebarOpen(true)} aria-label={t('shell.openMenu')}>☰</button>
            <h1 className="font-semibold text-lg capitalize truncate">{(() => {
              if (active === '/profile') return t('profile.title');
              const navItem = NAV.find(i => i.href === active);
              return navItem ? t(navItem.labelKey) : String(active || '').replace('/', '');
            })()}</h1>
          </div>
          <div className="flex items-center flex-wrap justify-end gap-2 sm:gap-3">
            <AppSwitcherButtons user={user} />
            <div className="relative">
              <button onClick={() => setNotifOpen(o => !o)} className="relative h-9 w-9 rounded-lg border border-[#D9E4E6] dark:border-white/[0.08] flex items-center justify-center text-sm transition-colors duration-200 hover:bg-[#E4EDEE] dark:hover:bg-white/5" aria-label={t('shell.notifications')}>
                <GlassIcon name="bell" size={18} />
                {unread > 0 && <span className="absolute -top-1 -end-1 h-4 min-w-4 px-1 rounded-full bg-[#EF4444] text-white text-[10px] leading-4 text-center">{unread > 9 ? '9+' : unread}</span>}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div className="glass-card absolute end-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] max-h-[70vh] overflow-y-auto z-40">
                    <div className="px-4 py-3 border-b border-[#D9E4E6] dark:border-white/[0.08] font-medium text-sm">{t('shell.notifications')}</div>
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-[#7C9296]">{t('shell.noNotificationsYet')}</div>
                    ) : notifications.map(n => (
                      <div key={n.id}
                        className={'w-full text-start px-4 py-3 border-b border-[#D9E4E6]/60 dark:border-white/5 hover:bg-[#EEF3F4] dark:hover:bg-white/5 transition-colors duration-200 ' + (n.is_read ? 'opacity-60' : '')}>
                        <button onClick={() => markRead(n.id, n.link)} className="w-full text-start">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium truncate">{tr(n.title)}</span>
                            {!n.is_read && <span className="h-2 w-2 rounded-full bg-brand-600 shrink-0" />}
                          </div>
                          {n.body && <div className="text-xs text-[#5E7579] whitespace-pre-line">{tr(n.body)}</div>}
                          <div className="text-[11px] text-[#7C9296] mt-0.5">{formatDate(n.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</div>
                        </button>
                        <button onClick={(e) => deleteNotification(e, n.id)} className="text-[11px] text-[#7C9296] hover:text-[#EF4444] mt-1">{t('shell.deleteNotification')}</button>
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
        <main className="flex-1 p-4 lg:p-6 min-w-0"><div className="max-w-[1800px] mx-auto">{children}</div></main>
      </div>
    </div>
  );
}