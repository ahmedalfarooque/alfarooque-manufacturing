'use client';

/* Reusable compact date-range filter — presets (All/Today/Yesterday/This
   Week/This Month/This Year) + Custom Range, all computed in the browser's
   LOCAL timezone (not UTC), so "Today" means the user's actual today.
   Intended for reuse across Sales, Purchases, and later Reports — value is
   always the plain { preset, from, to } shape a caller can turn into
   .gte()/.lte() filters, so nothing here is SmartLife/resource-specific. */

import { useEffect, useRef, useState } from 'react';
import { GlassButton, GlassInput } from '@/components/glass';

/* Labels below were 100% hardcoded English with no lang awareness at all
   (found during the interior shared-component audit) despite this being
   a widely-reused filter (Sales/Purchases/Purchase Requests/Reports).
   `t` is optional everywhere here — every caller that doesn't pass one
   gets the exact same English text as before (no regression); callers
   that do pass their own `t()` get it translated via the 'datefilter.*'
   namespace, with a same-file EN/AR fallback dictionary so this works
   immediately without requiring six apps' i18n.js files to gain new
   keys first. */
const STRINGS = {
  en: { all: 'All', today: 'Today', yesterday: 'Yesterday', this_week: 'This Week', this_month: 'This Month', this_year: 'This Year', custom: 'Custom Range',
    allDates: 'All dates', from: 'From', to: 'To', reset: 'Reset', apply: 'Apply', fromLabel: 'From {v}', untilLabel: 'Until {v}' },
  ar: { all: 'الكل', today: 'اليوم', yesterday: 'أمس', this_week: 'هذا الأسبوع', this_month: 'هذا الشهر', this_year: 'هذه السنة', custom: 'نطاق مخصص',
    allDates: 'كل التواريخ', from: 'من', to: 'إلى', reset: 'إعادة تعيين', apply: 'تطبيق', fromLabel: 'من {v}', untilLabel: 'حتى {v}' },
};
function localTr(lang, key, vars) {
  let str = STRINGS[lang === 'ar' ? 'ar' : 'en'][key] ?? key;
  if (vars) for (const k of Object.keys(vars)) str = str.replace(`{${k}}`, vars[k]);
  return str;
}
function tr(t, lang, key, vars) {
  if (t) { const viaApp = t('datefilter.' + key, vars); if (viaApp && viaApp !== 'datefilter.' + key) return viaApp; }
  return localTr(lang, key, vars);
}

function PRESETS_FOR(t, lang) { return [
  { key: 'all', label: tr(t, lang, 'all') },
  { key: 'today', label: tr(t, lang, 'today') },
  { key: 'yesterday', label: tr(t, lang, 'yesterday') },
  { key: 'this_week', label: tr(t, lang, 'this_week') },
  { key: 'this_month', label: tr(t, lang, 'this_month') },
  { key: 'this_year', label: tr(t, lang, 'this_year') },
  { key: 'custom', label: tr(t, lang, 'custom') },
]; }
/* Kept for any existing import of the plain English array. */
const PRESETS = PRESETS_FOR(null, 'en');

/* Local-calendar-date string, NOT toISOString() — that converts to UTC
   first, which silently shifts the date backward for any timezone ahead
   of UTC (caught in testing: "Today" in UTC+3 was reporting yesterday). */
function toISODate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

/* Computes an inclusive [from, to] ISO date pair for a preset, in local
   time. `to` is inclusive of the whole day it names (callers should treat
   it as `<= to` or `< to + 1 day`, never as an exclusive UTC midnight cut
   that silently drops same-day records). */
export function presetRange(preset) {
  const now = new Date();
  const today = startOfDay(now);
  switch (preset) {
    case 'today': return { from: toISODate(today), to: toISODate(today) };
    case 'yesterday': { const y = new Date(today); y.setDate(y.getDate() - 1); return { from: toISODate(y), to: toISODate(y) }; }
    case 'this_week': { const s = new Date(today); const dow = (s.getDay() + 6) % 7; s.setDate(s.getDate() - dow); return { from: toISODate(s), to: toISODate(today) }; }
    case 'this_month': { const s = new Date(today.getFullYear(), today.getMonth(), 1); return { from: toISODate(s), to: toISODate(today) }; }
    case 'this_year': { const s = new Date(today.getFullYear(), 0, 1); return { from: toISODate(s), to: toISODate(today) }; }
    case 'all': default: return { from: null, to: null };
  }
}

export function dateFilterLabel(value, t, lang = 'en') {
  if (!value || value.preset === 'all' || !value.preset) return tr(t, lang, 'allDates');
  const preset = PRESETS_FOR(t, lang).find(p => p.key === value.preset);
  if (value.preset === 'custom') {
    if (value.from && value.to) return `${value.from} → ${value.to}`;
    if (value.from) return tr(t, lang, 'fromLabel', { v: value.from });
    if (value.to) return tr(t, lang, 'untilLabel', { v: value.to });
    return tr(t, lang, 'custom');
  }
  return preset ? preset.label : tr(t, lang, 'allDates');
}

/* Returns true if `dateStr` (YYYY-MM-DD or any date-parseable string)
   falls within value's resolved range — callers filtering client-side
   records can use this directly instead of re-deriving from/to. */
export function inDateFilter(value, dateStr) {
  if (!value || value.preset === 'all' || !value.preset) return true;
  if (!dateStr) return false;
  const day = String(dateStr).slice(0, 10);
  const { from, to } = value.preset === 'custom' ? value : presetRange(value.preset);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export default function DateFilter({ value, onChange, t, lang = 'en' }) {
  const presets = PRESETS_FOR(t, lang);
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(value?.from || '');
  const [draftTo, setDraftTo] = useState(value?.to || '');
  const ref = useRef(null);

  useEffect(() => {
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function pick(presetKey) {
    if (presetKey === 'custom') { setOpen(true); return; }
    onChange({ preset: presetKey, from: null, to: null });
    setOpen(false);
  }

  function applyCustom() {
    onChange({ preset: 'custom', from: draftFrom || null, to: draftTo || null });
    setOpen(false);
  }

  function reset() {
    onChange({ preset: 'all', from: null, to: null });
    setDraftFrom(''); setDraftTo('');
    setOpen(false);
  }

  const active = value && value.preset && value.preset !== 'all';

  return (
    <div className="relative" ref={ref}>
      <GlassButton variant={active ? 'primary' : 'secondary'} size="sm" onClick={() => setOpen(o => !o)}>
        📅 {dateFilterLabel(value, t, lang)}
      </GlassButton>
      {open && (
        <div className="absolute z-20 mt-1 w-64 rounded-xl border border-[color:var(--bd)] bg-[color:var(--nav-bg)] p-2 shadow-xl backdrop-blur-xl">
          <div className="grid grid-cols-2 gap-1">
            {presets.map(p => (
              <button key={p.key} onClick={() => pick(p.key)}
                className={'rounded-lg px-2 py-1.5 text-start text-xs transition ' +
                  (value?.preset === p.key ? 'bg-[color:var(--pr-soft)] text-[color:var(--pr)]' : 'text-[color:var(--tx-2)] hover:bg-[color:var(--pr-soft)]')}>
                {p.label}
              </button>
            ))}
          </div>
          {(value?.preset === 'custom' || draftFrom || draftTo) && (
            <div className="mt-2 space-y-2 border-t border-[color:var(--bd)] pt-2">
              <label className="block text-xs text-[color:var(--tx-3)]">{tr(t, lang, 'from')}
                <GlassInput type="date" value={draftFrom} onChange={e => setDraftFrom(e.target.value)} />
              </label>
              <label className="block text-xs text-[color:var(--tx-3)]">{tr(t, lang, 'to')}
                <GlassInput type="date" value={draftTo} onChange={e => setDraftTo(e.target.value)} />
              </label>
              <div className="flex justify-end gap-2">
                <GlassButton variant="secondary" size="sm" onClick={reset}>{tr(t, lang, 'reset')}</GlassButton>
                <GlassButton size="sm" onClick={applyCustom}>{tr(t, lang, 'apply')}</GlassButton>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
