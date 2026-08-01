'use client';

import { getAppUrl } from '@/lib/appLinks';

const APPS = [
  { key: 'quotation', label: 'QuotePro' },
  { key: 'projects', label: 'Projects' },
  { key: 'cars', label: 'Fleet' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'accounting', label: 'Accounting' },
];

export default function AppSwitcherButtons({ role }) {
  if (role !== 'admin') return null;
  return (
    <div className="flex flex-col gap-1 py-2">
      {APPS.map(a => (
        <a key={a.key} href={getAppUrl(a.key)} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-white/10 hover:text-white transition-colors">
          {a.label}
        </a>
      ))}
    </div>
  );
}
