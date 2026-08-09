'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppSwitcherButtons from './AppSwitcherButtons';
import { GlassToastHost } from './glass';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/contacts', label: 'Contacts', icon: '👥' },
  { href: '/deals', label: 'Deals', icon: '🤝' },
  { href: '/activities', label: 'Activities', icon: '📅' },
  { href: '/pipeline', label: 'Pipeline', icon: '📈' },
  { href: '/reports', label: 'Reports', icon: '📋' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Shell({ children, session }) {
  const pathname = usePathname();
  const [showApps, setShowApps] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function logout() {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    window.location.href = '/login';
  }

  function toggleTheme() {
    const isLight = document.documentElement.classList.toggle('light');
    document.body.classList.toggle('light', isLight);
    localStorage.setItem('af-crm-theme', isLight ? 'light' : 'dark');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className={`flex flex-col bg-[#0d1526]/90 border-r border-white/8 transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'}`}>
        <div className="flex items-center justify-between px-3 py-4 border-b border-white/8">
          {!collapsed && <span className="text-sm font-bold text-cyan-400 tracking-wide">CRM</span>}
          <button onClick={() => setCollapsed(c => !c)} className="text-slate-400 hover:text-white text-xs px-1">
            {collapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV.map(item => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm transition-colors ${active ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
                <span>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {!collapsed && session?.role === 'admin' && (
          <div className="border-t border-white/8 px-2">
            <button onClick={() => setShowApps(s => !s)} className="w-full text-left px-2 py-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
              {showApps ? '▾' : '▸'} Switch App
            </button>
            {showApps && <AppSwitcherButtons role={session.role} />}
          </div>
        )}

        {!collapsed && (
          <div className="border-t border-white/8 p-3">
            <p className="text-xs text-slate-500 truncate">{session?.email}</p>
            <p className="text-xs text-cyan-600 capitalize">{session?.role}</p>
          </div>
        )}
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 bg-[#0d1526]/60 border-b border-white/8">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">AL FAROOQUE</span>
            <span className="text-slate-700">|</span>
            <span className="text-xs text-slate-400">CRM</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleTheme} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-colors">
              Theme
            </button>
            <button onClick={logout} className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1 rounded hover:bg-white/5 transition-colors">
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      <GlassToastHost />
    </div>
  );
}
