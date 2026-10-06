'use client';

/* Admin-only page requested by a non-admin session: say so plainly and
   offer the way back — replaces the old silent redirect to /dashboard.
   Identical across all six apps; each app's /forbidden page passes `lang`. */

import { useEffect, useState } from 'react';

const STRINGS = {
  en: { title: 'You don’t have permission to open this page', body: 'This area is for administrators only. Ask an administrator if you need access.', back: 'Back to dashboard' },
  ar: { title: 'ليس لديك صلاحية لفتح هذه الصفحة', body: 'هذه المنطقة للمسؤولين فقط. اطلب من المسؤول إذا كنت بحاجة إلى الوصول.', back: 'العودة إلى لوحة التحكم' },
};

export default function ForbiddenPage({ lang = 'en', dashboardPath = '/dashboard' }) {
  const s = STRINGS[lang === 'ar' ? 'ar' : 'en'];
  const [from, setFrom] = useState('');
  useEffect(() => { setFrom(new URLSearchParams(window.location.search).get('from') || ''); }, []);
  return (
    <main dir={lang === 'ar' ? 'rtl' : 'ltr'} className="min-h-screen flex items-center justify-center p-4 text-[color:var(--tx)]">
      <div role="alert" className="w-full max-w-md rounded-2xl border border-[color:var(--bd)] bg-[color:var(--bg-card)] p-6 shadow-2xl text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-500/10 text-amber-600 text-xl font-bold" aria-hidden="true">!</div>
        <h1 className="text-lg font-semibold">{s.title}</h1>
        <p className="mt-2 text-sm text-[color:var(--tx-3)]">{s.body}</p>
        {from && <p className="mt-1 text-xs text-[color:var(--tx-4)]" dir="ltr">{from}</p>}
        <a href={dashboardPath} className="mt-5 inline-block rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500">{s.back}</a>
      </div>
    </main>
  );
}
