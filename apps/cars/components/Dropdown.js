'use client';

/* Custom listbox replacing native <select> for every filter/form dropdown
   in the app. Native <select> option panels are rendered by the OS/browser
   chrome — Tailwind classes on the <select> itself can't reliably control
   the option list's background, text color, hover state, rounding, or
   z-index across browsers, which is exactly the "white overlay / wrong
   colors / clipped" bug this replaces. Fully custom-rendered = fully
   themeable, and matches this app's existing surface/border tokens. */

import { useEffect, useRef, useState } from 'react';

export default function Dropdown({ value, onChange, options, placeholder, className, disabled }) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const ref = useRef(null);

  const normalized = options.map(o => (Array.isArray(o) ? { value: o[0], label: o[1] } : { value: o, label: o }));
  const selected = normalized.find(o => String(o.value) === String(value));

  useEffect(() => {
    function onClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClickOutside); document.removeEventListener('keydown', onKey); };
  }, []);

  function toggle() {
    if (disabled) return;
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setOpenUp(window.innerHeight - rect.bottom < 260 && rect.top > 260);
    }
    setOpen(o => !o);
  }

  return (
    <div ref={ref} className={'relative ' + (className || '')}>
      <button type="button" onClick={toggle} disabled={disabled}
        className={
          'w-full flex items-center justify-between gap-2 rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/[0.03] px-3 py-2 text-sm text-start ' +
          (disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-brand-500/40 cursor-pointer')
        }>
        <span className={'truncate ' + (selected ? '' : 'text-slate-400')}>{selected ? selected.label : (placeholder || 'Select…')}</span>
        <span className={'text-slate-400 text-xs shrink-0 transition-transform ' + (open ? 'rotate-180' : '')}>▾</span>
      </button>
      {open && (
        <div className={
          'absolute z-50 start-0 end-0 min-w-max rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#0f172a] shadow-lg max-h-64 overflow-y-auto py-1 ' +
          (openUp ? 'bottom-full mb-1' : 'top-full mt-1')
        }>
          {normalized.map(o => (
            <button key={String(o.value)} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              className={
                'w-full text-start px-3 py-2 text-sm transition ' +
                (String(o.value) === String(value)
                  ? 'bg-brand-500/10 text-brand-500 font-medium'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10')
              }>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
