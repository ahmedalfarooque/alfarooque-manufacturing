'use client';

import { useEffect, useState } from 'react';
import { useLanguage, trEnum } from '@/lib/i18n';
import { GlassIcon } from '@/components/GlassIcons';
import AppSwitcherButtons from '@/components/AppSwitcherButtons';
import { GlassToastHost } from '@/components/glass';
import { readPref, writePref, THEME_PREF_COOKIE } from '@/lib/prefs';
import ModuleActionVisibility from '../../shared/ModuleActionVisibility';

const NAV = [
  { href: '/dashboard',        key: 'nav.dashboard',       icon: 'dashboard' },
  { href: '/products',         key: 'nav.products',        icon: 'package' },
  { href: '/categories',       key: 'nav.categories',      icon: 'tag' },
  { href: '/suppliers',        key: 'nav.suppliers',       icon: 'building' },
  { href: '/warehouses',       key: 'nav.warehouses',      icon: 'warehouse' },
  { href: '/locations',        key: 'nav.locations',       icon: 'map-pin' },
  { href: '/stock',            key: 'nav.stock',           icon: 'box' },
  { href: '/stock-movements',  key: 'nav.stockMovements',  icon: 'arrows' },
  { href: '/reservations',     key: 'nav.reservations',    icon: 'shield' },
  { href: '/transfers',        key: 'nav.transfers',       icon: 'truck' },
  { href: '/purchase-requests',key: 'nav.purchaseRequests',icon: 'clipboard' },
  { href: '/purchase-orders',  key: 'nav.purchaseOrders',  icon: 'file-text' },
  { href: '/goods-receipts',   key: 'nav.goodsReceipts',   icon: 'check-square' },
  { href: '/goods-issues',     key: 'nav.goodsIssues',     icon: 'door' },
  { href: '/reports',          key: 'nav.reports',         icon: 'bar-chart' },
  { href: '/settings',         key: 'nav.settings',        icon: 'settings' },
  { href: '/users',            key: 'Users',               icon: 'users', adminOnly: true },
];

export default function Shell({ children, active }) {
  const { lang, setLang, t } = useLanguage();
  const [user, setUser] = useState(null);
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setResults(null); return; }
    const timer = setTimeout(() => {
      fetch('/api/search?q=' + encodeURIComponent(query), { credentials: 'same-origin' })
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setResults(d))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setUser(d.user))
      .catch(() => {});
    try {
      const saved = readPref(THEME_PREF_COOKIE) || localStorage.getItem('af-inventory-theme');
      setDark(saved === 'dark');
    } catch (_) {}
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('af-inventory-theme', next ? 'dark' : 'light'); } catch (_) {}
    writePref(THEME_PREF_COOKIE, next ? 'dark' : 'light');
  }

  function toggleLanguage() {
    setLang(lang === 'ar' ? 'en' : 'ar');
  }

  async function logout() {
    try { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'logout' }) }); } catch (_) {}
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen flex text-[color:var(--tx)]">
      <ModuleActionVisibility />
      {/* Sidebar */}
      <aside className={
        'fixed lg:static z-40 inset-y-0 start-0 w-64 shrink-0 flex flex-col transition-transform af-sidebar ' +
        'bg-[color:var(--sidebar-bg)] border-e border-[color:var(--sidebar-border)] ' +
        'shadow-[8px_0_40px_rgba(11,27,41,0.06)] dark:shadow-[8px_0_40px_rgba(0,0,0,0.4)] ' +
        (sidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:!translate-x-0')
      }>
        <div className="flex items-center gap-3 px-5 h-16 border-b border-[color:var(--sidebar-border)]">
          <span className="icon-tile icon-tile--sm !p-0 overflow-hidden">
            <img src="/logo.png" alt="AL FAROOQUE" className="h-6 w-6 object-contain" />
          </span>
          <div>
            <div className="font-semibold text-sm leading-tight text-[color:var(--sidebar-active-text)]">Inventory</div>
            <div className="text-[11px] text-[color:var(--sidebar-text-muted)]">{t('shell.tagline')}</div>
          </div>
        </div>
        <div className="px-5 pt-3 pb-1 text-[11px] uppercase tracking-wider text-[color:var(--sidebar-text-muted)]">{user?.role ? trEnum(t, 'role', user.role) : ' '}</div>
        <div className="mx-3 mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 border border-[color:var(--sidebar-border)] bg-[color:var(--sidebar-hover-bg)]">
          <span className="h-8 w-8 rounded-full grid place-items-center text-xs font-semibold text-[color:var(--sidebar-active-text)] bg-[color:var(--sidebar-active-bg)] border border-[color:var(--sidebar-border)] shrink-0">
            {(user?.full_name || user?.email || '?').slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="text-sm truncate text-[color:var(--sidebar-text)]">{user?.full_name || t('shell.loading')}</div>
            <div className="text-[11px] text-[color:var(--sidebar-text-muted)] capitalize truncate">{user?.role ? trEnum(t, 'role', user.role) : ''}</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-2 overflow-y-auto">
          {NAV.filter(item => !item.adminOnly || user?.role === 'admin').map(item => (
            <a key={item.href} href={item.href}
              className={
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ' +
                (active === item.href
                  ? 'bg-[color:var(--sidebar-active-bg)] text-[color:var(--sidebar-active-text)]'
                  : 'text-[color:var(--sidebar-text)] hover:bg-[color:var(--sidebar-hover-bg)] hover:text-[color:var(--sidebar-active-text)]')
              }>
              <GlassIcon name={item.icon} size={20} className="shrink-0" />{item.key === 'Users' ? 'Users' : t(item.key)}
            </a>
          ))}
        </nav>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="af-topbar h-16 flex items-center justify-between gap-3 px-4 lg:px-6 border-b border-[color:var(--sidebar-border)] bg-[color:var(--sidebar-bg)] sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button className="lg:hidden gbtn gbtn-ghost gbtn--icon gbtn--sm text-xl text-[color:var(--sidebar-text)]" onClick={() => setSidebarOpen(true)} aria-label="Menu">☰</button>
            <h1 className="font-semibold text-lg hidden sm:block text-[color:var(--sidebar-active-text)]">{t(NAV.find(n => n.href === active)?.key) || active.replace('/', '')}</h1>
          </div>
          <div className="flex items-center gap-3 flex-1 max-w-md relative">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onBlur={() => setTimeout(() => setResults(null), 150)}
              placeholder={t('shell.searchPlaceholder')}
              className="ginput"
            />
            {results && (results.products?.length > 0 || results.suppliers?.length > 0) && (
              <div className="glass-card absolute top-full mt-1 start-0 end-0 max-h-80 overflow-y-auto z-30">
                {results.products?.length > 0 && (
                  <div>
                    <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">{t('shell.searchProducts')}</div>
                    {results.products.map(p => (
                      <a key={p.id} href={'/products/' + p.id} className="block px-3 py-2 text-sm hover:bg-[color:var(--pr-soft)]">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-[color:var(--tx-4)]">{p.sku || '—'}</div>
                      </a>
                    ))}
                  </div>
                )}
                {results.suppliers?.length > 0 && (
                  <div>
                    <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-[color:var(--tx-4)]">{t('shell.searchSuppliers')}</div>
                    {results.suppliers.map(s => (
                      <a key={s.id} href={'/suppliers/' + s.id} className="block px-3 py-2 text-sm hover:bg-[color:var(--pr-soft)]">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-[color:var(--tx-4)]">{s.city || '—'}</div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <AppSwitcherButtons user={user} />
            <button onClick={toggleLanguage} className="glass-ctrl" aria-label={t('shell.toggleLanguage')}>
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
