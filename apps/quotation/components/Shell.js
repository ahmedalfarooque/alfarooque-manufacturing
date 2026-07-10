'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { GlassIcon } from '@/components/GlassIcons';

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
      const saved = localStorage.getItem('af-quotation-theme');
      setDark(saved === 'dark');
    } catch (_) {}
  }, []);

  useEffect(() => {
    function loadNotifications() {
      fetch('/api/notifications', { credentials: 'same-origin' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) { setNotifications(d.notifications || []); setUnread(d.unread || 0); } })
        .catch(() => {});
    }
    loadNotifications();
    const interval = setInterval(loadNotifications, 20000);
    return () => clearInterval(interval);
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

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('af-quotation-theme', next ? 'dark' : 'light'); } catch (_) {}
  }

  async function logout() {
    try { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'logout' }) }); } catch (_) {}
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen flex bg-[#F7F5F1] dark:bg-[#14140F] text-[#1A1A18] dark:text-[#F5F3EE] transition-colors duration-300">
      <aside className={
        'fixed lg:static z-40 inset-y-0 start-0 w-64 shrink-0 bg-white/80 dark:bg-[#1B1B14]/75 backdrop-blur-2xl backdrop-saturate-150 border-e border-[#E5E2DD] dark:border-white/[0.08] text-[#4A4A45] dark:text-[#A8A497] flex flex-col transition-transform shadow-[4px_0_24px_rgba(26,26,24,0.04)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.3)] ' +
        (sidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:!translate-x-0')
      }>
        <div className="flex items-center gap-3 px-5 h-16 border-b border-[#E5E2DD] dark:border-white/[0.08]">
          <div className="h-9 w-9 rounded-lg bg-brand-600/10 border border-brand-600/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold">QP</div>
          <div>
            <div className="text-[#1A1A18] dark:text-[#F5F3EE] font-semibold text-sm leading-tight">{t('shell.appName')}</div>
            <div className="text-[11px] text-[#8C8A80]">{t('shell.appTagline')}</div>
          </div>
        </div>
        <div className="px-5 py-3 flex items-center gap-2 border-b border-[#E5E2DD] dark:border-white/[0.08]">
          <div className="h-8 w-8 rounded-full bg-brand-600/15 flex items-center justify-center text-xs font-medium text-brand-700 dark:text-brand-300">
            {(user?.full_name || user?.email || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm text-[#1A1A18] dark:text-[#F5F3EE] truncate">{user?.full_name || t('shell.loading')}</div>
            <div className="text-[11px] text-[#8C8A80] truncate">{user?.role ? t('role.' + user.role) : ''}</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-2 overflow-y-auto">
          {NAV.filter(item => !item.adminOnly || user?.role === 'admin').map(item => (
            <a key={item.href} href={item.href}
              className={
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-200 ' +
                (active === item.href ? 'bg-brand-600 text-white shadow-sm' : 'hover:bg-[#F1EEE7] dark:hover:bg-white/5 text-[#4A4A45] dark:text-[#A8A497]')
              }>
              <GlassIcon name={item.icon} size={20} className="shrink-0" />{t(item.labelKey)}
            </a>
          ))}
        </nav>
        <div className="p-3">
          <button onClick={logout} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#4A4A45] dark:text-[#A8A497] hover:bg-[#F1EEE7] dark:hover:bg-white/5 transition-colors duration-200">
            <GlassIcon name="logout" size={20} className="shrink-0" />{t('shell.logout')}
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-[#E5E2DD] dark:border-white/[0.08] bg-white/75 dark:bg-[#1B1B14]/65 backdrop-blur-2xl backdrop-saturate-150 sticky top-0 z-20 shadow-[0_2px_16px_rgba(26,26,24,0.04)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-xl" onClick={() => setSidebarOpen(true)}>☰</button>
            <h1 className="font-semibold text-lg capitalize">{(() => { const navItem = NAV.find(i => i.href === active); return navItem ? t(navItem.labelKey) : String(active || '').replace('/', ''); })()}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button onClick={() => setNotifOpen(o => !o)} className="relative h-9 w-9 rounded-lg border border-[#E5E2DD] dark:border-white/[0.08] flex items-center justify-center text-sm transition-colors duration-200 hover:bg-[#F1EEE7] dark:hover:bg-white/5" aria-label={t('shell.notifications')}>
                <GlassIcon name="bell" size={18} />
                {unread > 0 && <span className="absolute -top-1 -end-1 h-4 min-w-4 px-1 rounded-full bg-[#BC6B4E] text-white text-[10px] leading-4 text-center">{unread > 9 ? '9+' : unread}</span>}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div className="glass-card absolute end-0 mt-2 w-80 max-h-96 overflow-y-auto z-40">
                    <div className="px-4 py-3 border-b border-[#E5E2DD] dark:border-white/[0.08] font-medium text-sm">{t('shell.notifications')}</div>
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-[#8C8A80]">{t('shell.noNotificationsYet')}</div>
                    ) : notifications.map(n => (
                      <button key={n.id} onClick={() => markRead(n.id, n.link)}
                        className={'w-full text-start px-4 py-3 border-b border-[#E5E2DD]/60 dark:border-white/5 hover:bg-[#F7F5F1] dark:hover:bg-white/5 transition-colors duration-200 ' + (n.is_read ? 'opacity-60' : '')}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{tr(n.title)}</span>
                          {!n.is_read && <span className="h-2 w-2 rounded-full bg-brand-600 shrink-0" />}
                        </div>
                        {n.body && <div className="text-xs text-[#6B6B63] truncate">{tr(n.body)}</div>}
                        <div className="text-[11px] text-[#8C8A80] mt-0.5">{formatDate(n.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="glass-ctrl" aria-label={t('shell.toggleLanguage')}>
              <span className="ctrl-label">{lang === 'ar' ? 'EN' : 'عربي'}</span>
            </button>
            <button onClick={toggleTheme} className="glass-ctrl" aria-label={t('shell.toggleTheme')} aria-pressed={dark}>
              <GlassIcon name={dark ? 'sun' : 'moon'} size={16} className="ctrl-icon" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 min-w-0"><div className="max-w-[1800px] mx-auto">{children}</div></main>
      </div>
    </div>
  );
}
