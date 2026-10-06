'use client';

/* "Page view" — one column model per list page drives the on-screen table,
   Print and Download PDF, so a hidden column never appears in an export.

   A column: { key, label, render(row), pdf(row), sort?, required?, hidden?,
   noPdf?, className? }
     - required: cannot be hidden (e.g. Actions)
     - hidden:   not shown by default (optional extra column)
     - noPdf:    never exported (interactive columns such as Actions)
   The user's choice is remembered per page in localStorage
   ('af-cars-cols:<pageKey>'); unknown/removed keys are ignored, and the
   stored order is always the page's declared order. */

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { useLanguage } from '@/lib/i18n';
import { GlassIcon } from '@/components/GlassIcons';

const STORAGE_PREFIX = 'af-cars-cols:';

function defaultKeys(columns) {
  return columns.filter(c => !c.hidden || c.required).map(c => c.key);
}

export function useColumnPrefs(pageKey, columns) {
  const [visibleKeys, setVisibleKeys] = useState(() => defaultKeys(columns));
  const [loaded, setLoaded] = useState(false);
  const keyList = columns.map(c => c.key).join('|');

  /* Re-run whenever the column list changes (e.g. an admin-only Actions
     column appearing once the session loads) so new columns get their
     default visibility instead of staying hidden. */
  useEffect(() => {
    let next = null;
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + pageKey);
      const saved = raw ? JSON.parse(raw) : null;
      if (Array.isArray(saved)) {
        const known = new Set(columns.map(c => c.key));
        next = saved.filter(k => known.has(k));
        for (const c of columns) if (c.required && !next.includes(c.key)) next.push(c.key);
      }
    } catch (_) {}
    setVisibleKeys(next || defaultKeys(columns));
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey, keyList]);

  const persist = useCallback(keys => {
    setVisibleKeys(keys);
    try { localStorage.setItem(STORAGE_PREFIX + pageKey, JSON.stringify(keys)); } catch (_) {}
  }, [pageKey]);

  const set = new Set(visibleKeys);
  const visibleCols = columns.filter(c => set.has(c.key));
  return {
    loaded,
    visibleCols,
    isVisible: key => set.has(key),
    toggle: key => {
      const col = columns.find(c => c.key === key);
      if (!col || col.required) return;
      persist(set.has(key) ? visibleKeys.filter(k => k !== key) : columns.map(c => c.key).filter(k => k === key || set.has(k)));
    },
    selectAll: () => persist(columns.map(c => c.key)),
    reset: () => { persist(defaultKeys(columns)); },
  };
}

/* Export helpers: only visible, exportable columns, in page order. */
export function pdfColumns(visibleCols) {
  return visibleCols.filter(c => !c.noPdf).map(c => ({ key: c.key, header: c.label }));
}
export function pdfRows(visibleCols, rows) {
  const cols = visibleCols.filter(c => !c.noPdf);
  return (rows || []).map((row, i) => Object.fromEntries(cols.map(c => [c.key, c.pdf ? c.pdf(row, i) : (row[c.key] ?? '')])));
}

export default function ColumnPicker({ columns, prefs, className = '' }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const popRef = useRef(null);
  const [side, setSide] = useState('end');
  const hideable = columns.filter(c => !c.required);
  const shown = prefs.visibleCols.length;

  /* Keep the popover inside the viewport: it hangs from the button's end
     edge by default and flips to the start edge when that would overflow
     (narrow screens, RTL). */
  useLayoutEffect(() => {
    if (!open || !popRef.current) return;
    const r = popRef.current.getBoundingClientRect();
    if (r.right > window.innerWidth - 8) setSide(document.dir === 'rtl' ? 'end' : 'start');
    else if (r.left < 8) setSide(document.dir === 'rtl' ? 'start' : 'end');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className={'relative ' + className}>
      <button type="button" onClick={() => { setSide('end'); setOpen(o => !o); }} aria-haspopup="true" aria-expanded={open} aria-label={t('pv.button') + ' (' + shown + '/' + columns.length + ')'}
        className="gbtn gbtn-secondary gbtn--sm gap-1.5">
        <GlassIcon name="grid" size={16} bare /><span>{t('pv.button')}</span>
        <span className="text-[11px] tabular-nums opacity-70">{shown}/{columns.length}</span>
      </button>
      {open && (
        <div ref={popRef} role="group" aria-label={t('pv.title')} className={'glass-card absolute z-30 mt-1 w-[min(18rem,calc(100vw-2rem))] p-2 shadow-lg ' + (side === 'start' ? 'start-0' : 'end-0')}>
          <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-2 border-b border-[color:var(--bd)]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--tx-3)]">{t('pv.title')}</span>
            <span className="flex gap-2 text-[11px]">
              <button type="button" className="text-brand-500 hover:underline" onClick={prefs.selectAll}>{t('pv.selectAll')}</button>
              <button type="button" className="text-brand-500 hover:underline" onClick={prefs.reset}>{t('pv.reset')}</button>
            </span>
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {columns.map(c => (
              <li key={c.key}>
                <label className={'flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm ' + (c.required ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-[color:var(--pr-soft)]')}>
                  <input type="checkbox" className="accent-[color:var(--pr)] h-4 w-4" checked={prefs.isVisible(c.key)} disabled={c.required} onChange={() => prefs.toggle(c.key)} />
                  <span className="truncate">{c.label}</span>
                  {c.required && <span className="ms-auto text-[10px] text-[color:var(--tx-4)]">{t('pv.required')}</span>}
                </label>
              </li>
            ))}
          </ul>
          <div className="px-2 pt-2 pb-1 border-t border-[color:var(--bd)] text-[11px] text-[color:var(--tx-4)]">{t('pv.hint', { n: shown, total: columns.length, hideable: hideable.length })}</div>
        </div>
      )}
    </div>
  );
}
