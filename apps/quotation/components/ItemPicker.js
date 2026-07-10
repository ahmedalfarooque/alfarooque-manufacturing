'use client';

/* Master-data picker used inside the cost-model editor. Searches the
   right API per section and returns the picked master row via onPick.
   Keyboard-first: type to search, ↑/↓ to move, Enter to add, Esc closes. */

import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { formatMaterialDims } from '@/lib/dims';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Input } from '@/components/ui';

const API_BY_SECTION = {
  material: '/api/materials?kind=material&q=',
  hardware: '/api/materials?kind=hardware&q=',
  labour: '/api/labour?q=',
  machine: '/api/machines?q=',
  expense: '/api/expenses?q=',
};

export default function ItemPicker({ section, onPick }) {
  const { t, tr, trL, lang, formatNumber } = useLanguage();
  const [q, setQ] = useState('');
  const dq = useDebouncedValue(q, 200);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!API_BY_SECTION[section]) return;
    fetch(API_BY_SECTION[section] + encodeURIComponent(dq), { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(d => { setRows((d.rows || []).slice(0, 12)); setIdx(0); })
      .catch(() => setRows([]));
  }, [dq, section]);

  useEffect(() => {
    function onDoc(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(row) {
    onPick(row);
    setQ('');
    setOpen(false);
  }

  function onKey(e) {
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (rows[idx]) pick(rows[idx]); }
    else if (e.key === 'Escape') setOpen(false);
  }

  const name = (r) => trL(r, 'name');

  function meta(r) {
    if (section === 'material' || section === 'hardware') {
      return [formatMaterialDims(r, t), r.unit, formatNumber(r.latest_price, { minimumFractionDigits: 2 }) + ' ' + t('common.currencyUnit'), formatNumber(r.default_waste_pct) + '%']
        .filter(Boolean).join(' · ');
    }
    if (section === 'labour') {
      return `${formatNumber(r.hourly_rate)}/${t('unit.hour')} · ${formatNumber(r.daily_rate)}/${t('unit.day')} · ${formatNumber(r.monthly_rate)}/${t('unit.month')}`;
    }
    if (section === 'machine') {
      return `${formatNumber(r.hourly_cost, { minimumFractionDigits: 2 })} ${t('common.currencyUnit')}/${t('unit.hour')}` + (Number(r.setup_cost) ? ` · ${t('f.setupCost')} ${formatNumber(r.setup_cost)}` : '');
    }
    if (section === 'expense') {
      return t('expcat.' + r.category) + ' · ' + formatNumber(r.default_amount) + ' · ' + t('expunit.' + r.unit);
    }
    return '';
  }

  if (!API_BY_SECTION[section]) return null;

  return (
    <div ref={boxRef} className="relative max-w-md">
      <Input
        value={q}
        onFocus={() => setOpen(true)}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        onKeyDown={onKey}
        placeholder={t('cost.pickPlaceholder')}
      />
      {open && rows.length > 0 && (
        <div className="glass-card absolute z-30 mt-1 w-full bg-white dark:bg-[#1B1B14] shadow-xl max-h-72 overflow-y-auto">
          {rows.map((r, i) => (
            <button key={r.id} type="button" onClick={() => pick(r)} onMouseEnter={() => setIdx(i)}
              className={'w-full text-start px-3 py-2 border-b border-[#E5E2DD]/60 dark:border-white/5 transition-colors ' +
                (i === idx ? 'bg-brand-600/10' : '')}>
              <div className="text-sm font-medium truncate">{name(r)}</div>
              <div className="text-[11px] text-[#8C8A80] truncate" dir="ltr">{meta(r)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
