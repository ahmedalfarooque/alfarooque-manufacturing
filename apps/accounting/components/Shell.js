'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { GlassIcon } from '@/components/GlassIcons';
import AppSwitcherButtons from '@/components/AppSwitcherButtons';
import { GlassToastHost } from '@/components/glass';
import { readPref, writePref, THEME_PREF_COOKIE } from '@/lib/prefs';

const NAV = [
  { href: '/dashboard',         label: 'Dashboard',         labelAr: 'لوحة التحكم',     icon: 'dashboard' },
  { href: '/chart-of-accounts', label: 'Chart of Accounts', labelAr: 'دليل الحسابات',   icon: 'layers' },
  { href: '/journal-entries',   label: 'Journal Entries',   labelAr: 'القيود اليومية',   icon: 'file-text' },
  { href: '/invoices',          label: 'Invoices',          labelAr: 'الفواتير',          icon: 'receipt' },
  { href: '/bills',             label: 'Bills',             labelAr: 'المستحقات',         icon: 'clipboard' },
  { href: '/payments',          label: 'Payments',          labelAr: 'المدفوعات',         icon: 'credit-card' },
  { href: '/banking',           label: 'Banking',           labelAr: 'البنوك',             icon: 'bank' },
  { href: '/expenses',          label: 'Expenses',          labelAr: 'المصروفات',         icon: 'trending-up' },
  { href: '/assets',            label: 'Assets',            labelAr: 'الأصول',            icon: 'box' },
  { href: '/reports',           label: 'Reports',           labelAr: 'التقارير',          icon: 'bar-chart' },
  { href: '/settings',          label: 'Settings',          labelAr: 'الإعدادات',         icon: 'settings' },
];

export default function Shell({ children, active }) {
  const { lang, setLang } = useLanguage();
  const [user, setUser] = useState(null);
  const [dark, setDark] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setUser(d.user))
      .catch(() => {});
    try {
      const saved = readPref(THEME_PREF_COOKIE) || localStorage.getItem('af-accounting-theme');
      setDark(saved === 'dark');
    } catch (_) {}
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('af-accounting-theme', next ? 'dark' : 'light'); } catch (_) {}
    writePref(THEME_PREF_COOKIE, next ? 'dark' : 'light');
  }

  async function logout() {
    try { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'logout' }) }); } catch (_) {}
    window.location.href = '/login';
  }

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

  return (
    <div className="min-h-screen flex text-[color:var(--tx)]">
      {/* Sidebar */}
      <aside className={
        'fixed lg:static z-40 inset-y-0 start-0 w-64 shrink-0 flex flex-col transition-transform ' +
        'bg-[color:var(--nav-bg)] backdrop-blur-2xl backdrop-saturate-150 border-e border-[color:var(--bd)] ' +
        (sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
      }>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-[color:var(--bd)] shrink-0">
          <img src="/logo.png" alt="AF" className="h-9 w-9 object-contain rounded-xl" />
          <div>
            <div className="text-[color:var(--tx)] font-bold text-sm leading-tight">AL FAROOQUE</div>
            <div className="text-[color:var(--tx-3)] text-[10px]">{lang === 'ar' ? 'المحاسبة' : 'Accounting'}</div>
          </div>
        </div>
        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {NAV.map(item => {
            const isActive = active === item.href || currentPath.startsWith(item.href);
            return (
              <a key={item.href} href={item.href}
                className={
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ' +
                  (isActive
                    ? 'bg-[color:var(--pr-soft)] text-[color:var(--pr)] border border-[rgba(6,182,212,0.25)]'
                    : 'text-[color:var(--tx-2)] hover:bg-[color:var(--pr-soft)] hover:text-[color:var(--tx)]')
                }>
                <GlassIcon name={item.icon} size={18} />
                <span>{lang === 'ar' ? item.labelAr : item.label}</span>
              </a>
            );
          })}
        </nav>
        {/* User */}
        {user && (
          <div className="px-4 py-3 border-t border-[color:var(--bd)] shrink-0">
            <div className="text-xs font-medium text-[color:var(--tx-2)] truncate">{user.email}</div>
            <div className="text-[10px] text-[color:var(--tx-4)] capitalize">{user.role}</div>
          </div>
        )}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 shrink-0 flex items-center gap-3 px-4 border-b border-[color:var(--bd)] bg-[color:var(--nav-bg)] backdrop-blur-xl">
          <button className="lg:hidden glass-ctrl gbtn--icon" onClick={() => setSidebarOpen(o => !o)}>☰</button>
          <div className="flex-1" />
          <AppSwitcherButtons user={user} />
          <button type="button" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="glass-ctrl" title="Toggle language">
            <span className="ctrl-label">{lang === 'ar' ? 'EN' : 'ع'}</span>
          </button>
          <button type="button" onClick={toggleTheme} className="glass-ctrl" title="Toggle theme" aria-pressed={dark}>
            <GlassIcon name={dark ? 'sun' : 'moon'} size={16} className="ctrl-icon" />
          </button>
          <button type="button" onClick={logout} className="glass-ctrl" title="Logout">
            <GlassIcon name="log-out" size={16} className="ctrl-icon" />
          </button>
        </header>
        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
      <GlassToastHost />
    </div>
  );
}
