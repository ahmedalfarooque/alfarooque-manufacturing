'use client';

import { useEffect, useState } from 'react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/projects', label: 'Projects', icon: '\u{1F4C1}' },
  { href: '/customers', label: 'Customers', icon: '\u{1F465}' },
];

export default function Shell({ children, active }) {
  const [user, setUser] = useState(null);
  const [dark, setDark] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch('/projects/api/auth', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setUser(d.user))
      .catch(() => {});
    try {
      const saved = localStorage.getItem('af-projects-theme');
      setDark(saved !== 'light');
    } catch (_) {}
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('af-projects-theme', next ? 'dark' : 'light'); } catch (_) {}
  }

  async function logout() {
    try { await fetch('/projects/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'logout' }) }); } catch (_) {}
    window.location.href = '/projects/login';
  }

  return (
    <div className="min-h-screen flex bg-[#f3f5f7] dark:bg-[#0b1220] text-slate-900 dark:text-slate-100">
      <aside className={
        'fixed lg:static z-40 inset-y-0 left-0 w-64 shrink-0 bg-[#0f172a] text-slate-300 flex flex-col transition-transform ' +
        (sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
      }>
        <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
          <div className="h-9 w-9 rounded-lg bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400 font-bold">PT</div>
          <div>
            <div className="text-white font-semibold text-sm leading-tight">ProTrack</div>
            <div className="text-[11px] text-slate-500">Project Management</div>
          </div>
        </div>
        <div className="px-5 py-3 text-[11px] uppercase tracking-wider text-slate-500">{user?.role || ' '}</div>
        <div className="px-5 pb-3 flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-white">
            {(user?.full_name || user?.email || '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm text-white truncate">{user?.full_name || 'Loading…'}</div>
            <div className="text-[11px] text-slate-500 capitalize truncate">{user?.role}</div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-2">
          {NAV.map(item => (
            <a key={item.href} href={'/projects' + item.href}
              className={
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ' +
                (active === item.href ? 'bg-brand-500 text-white' : 'hover:bg-white/5 text-slate-300')
              }>
              <span className="w-4 text-center">{item.icon}</span>{item.label}
            </a>
          ))}
        </nav>
        <div className="p-3">
          <button onClick={logout} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5">
            <span className="w-4 text-center">→</span>Logout
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 border-b border-black/5 dark:border-white/10 bg-white/70 dark:bg-[#0f172a]/60 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button className="lg:hidden text-xl" onClick={() => setSidebarOpen(true)}>☰</button>
            <h1 className="font-semibold text-lg capitalize">{active.replace('/', '')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="h-9 w-9 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-sm" aria-label="Toggle theme">
              {dark ? '☀️' : '\u{1F319}'}
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
