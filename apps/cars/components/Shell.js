'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { GlassIcon } from '@/components/GlassIcons';

const NAV = [
  { href: '/dashboard', key: 'nav.dashboard', icon: 'dashboard' },
  { href: '/vehicles', key: 'nav.vehicles', icon: 'truck' },
  { href: '/drivers', key: 'nav.drivers', icon: 'users' },
  { href: '/maintenance-schedule', key: 'nav.maintenanceSchedule', icon: 'wrench' },
  { href: '/maintenance', key: 'nav.maintenance', icon: 'wrench' },
  { href: '/maintenance-shops', key: 'nav.maintenanceShops', icon: 'wrench' },
  { href: '/alerts', key: 'nav.alerts', icon: 'bell' },
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
    const t = setTimeout(() => {
      fetch('/api/search?q=' + encodeURIComponent(query), { credentials: 'same-origin' })
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setResults(d))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setUser(d.user))
      .catch(() => {});
    try {
      const saved = localStorage.getItem('af-cars-theme');
      setDark(saved === 'dark');
    } catch (_) {}
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('af-cars-theme', next ? 'dark' : 'light'); } catch (_) {}
  }

  function toggleLanguage() {
    setLang(lang === 'ar' ? 'en' : 'ar');
  }

  async function logout() {
    try { await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'logout' }) }); } catch (_) {}
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen flex bg-[#FFFFFF] dark:bg-[#14140F] text-[#1A1A18] dark:text-[#F5F3EE] transition-colors duration-300">
      {/* Sidebar */}
      <aside className={
        'fixed lg:static z-40 inset-y-0 start-0 w-64 shrink-0 bg-[#F7F5F1]/85 dark:bg-[#1B1B14]/75 backdrop-blur-2xl backdrop-saturate-150 border-e border-[#E5E2DD] dark:border-white/10 text-[#4A4A45] dark:text-[#A8A497] flex flex-col transition-transform shadow-[4px_0_24px_rgba(26,26,24,0.04)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.3)] ' +
        (sidebarOpen ? 'translate-x-0' : '-translate-x-full rtl:translate-x-full lg:!translate-x-0')
      }>
        <div className="flex items-center gap-3 px-5 h-16 border-b border-[#E5E2DD] dark:border-white/10">
          <div className="h-9 w-9 rounded-lg bg-[#6B7A4F]/10 border border-[#6B7A4F]/30 flex items-center justify-center text-[#6B7A4F] dark:text-brand-400 font-bold">TF</div>
          <div>
            <div className="text-[#1A1A18] dark:text-[#F5F3EE] font-semibold text-sm leading-tight">TrackFleet</div>
            <div className="text-[11px] text-[#8C8A80]">{t('shell.tagline')}</div>
          </div>
        </div>
        <div className="px-5 py-3 text-[11px] uppercase tracking-wider text-[#8C8A80]">{user?.role || ' '}</div>
        <div className="px-5 pb-3 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-[#6B7A4F]/15 flex items-center justify-center text-xs font-medium text-[#566440] dark:text-brand-300">
            {(user?.full_name || user?.email || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm text-[#1A1A18] dark:text-[#F5F3EE] truncate">{user?.full_name || t('shell.loading')}</div>
            <div className="text-[11px] text-[#8C8A80] capitalize truncate">{user?.role}</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-2">
          {NAV.map(item => (
            <a key={item.href} href={item.href}
              className={
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ' +
                (active === item.href ? 'bg-brand-600 text-white shadow-sm' : 'hover:bg-[#6B7A4F]/8 dark:hover:bg-white/5 text-[#4A4A45] dark:text-[#A8A497]')
              }>
              <GlassIcon name={item.icon} size={20} className="shrink-0" />{t(item.key)}
            </a>
          ))}
        </nav>
        <div className="p-3">
          <button onClick={logout} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#4A4A45] dark:text-[#A8A497] hover:bg-[#6B7A4F]/8 dark:hover:bg-white/5 transition">
            <GlassIcon name="logout" size={20} className="shrink-0" />{t('shell.logout')}
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-[#E5E2DD] dark:border-white/10 bg-white/75 dark:bg-[#1B1B14]/65 backdrop-blur-2xl backdrop-saturate-150 sticky top-0 z-20 shadow-[0_2px_16px_rgba(26,26,24,0.04)] dark:shadow-[0_2px_16px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-xl" onClick={() => setSidebarOpen(true)}>☰</button>
            <h1 className="font-semibold text-lg hidden sm:block">{t(NAV.find(n => n.href === active)?.key) || active.replace('/', '')}</h1>
          </div>
          <div className="flex items-center gap-3 flex-1 max-w-md relative">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onBlur={() => setTimeout(() => setResults(null), 150)}
              placeholder={t('shell.searchPlaceholder')}
              className="w-full rounded-lg border border-[#E5E2DD] dark:border-white/10 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#6B7A4F]/40 focus:border-[#6B7A4F]/40 transition"
            />
            {results && (results.vehicles.length > 0 || results.drivers.length > 0) && (
              <div className="glass-card absolute top-full mt-1 start-0 end-0 max-h-80 overflow-y-auto z-30">
                {results.vehicles.length > 0 && (
                  <div>
                    <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-[#8C8A80]">{t('shell.searchVehicles')}</div>
                    {results.vehicles.map(v => (
                      <a key={v.id} href={'/vehicles/' + v.id} className="block px-3 py-2 text-sm hover:bg-[#6B7A4F]/8 dark:hover:bg-white/[0.05]">
                        <div className="font-medium">{v.vehicle_number}</div>
                        <div className="text-xs text-[#8C8A80]">{v.name || '—'}</div>
                      </a>
                    ))}
                  </div>
                )}
                {results.drivers.length > 0 && (
                  <div>
                    <div className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-[#8C8A80]">{t('shell.searchDrivers')}</div>
                    {results.drivers.map(d => (
                      <a key={d.id} href={'/drivers/' + d.id} className="block px-3 py-2 text-sm hover:bg-[#6B7A4F]/8 dark:hover:bg-white/[0.05]">
                        <div className="font-medium">{d.full_name}</div>
                        <div className="text-xs text-[#8C8A80]">{d.phone || d.license_number || '—'}</div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleLanguage} className="glass-ctrl" aria-label={t('shell.toggleLanguage')}>
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
