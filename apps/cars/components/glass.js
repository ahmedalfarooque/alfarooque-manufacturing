'use client';

/* ═══════════════════════════════════════════════════════════════════════
   AL FAROOQUE — Shared premium glass component library.
   ONE visual system, inherited from the TrackFleet login (deep navy +
   bright cyan glass). Every authenticated screen composes these primitives
   so QuotePro, Projects and TrackFleet read as one product. Purely
   presentational — no data, auth, routing or business logic lives here.
   Colour + glass recipes read from the CSS tokens/classes in globals.css
   (--pr, --tx, .glass-card …) so a token change restyles everything.

   NOTE: GlassLayout / GlassSidebar / GlassHeader are provided by
   components/Shell.js (the app frame). This file provides everything that
   composes INSIDE a page.
   ═══════════════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from 'react';
import { GlassIcon } from './GlassIcons';
import TrendLine from './TrendLine';
import ProgressRing from './ProgressRing';

export { GlassIcon };

export const TONE = {
  brand: '#25D4FF', cyan: '#36E2FF', blue: '#0EA5E9',
  emerald: '#34D399', amber: '#FBBF24', red: '#F87171', slate: '#8CA6B8',
};
const INPUT = 'w-full rounded-xl border border-[var(--bd-2)] bg-white/70 dark:bg-white/[0.05] px-3.5 py-2.5 text-sm text-[var(--tx)] placeholder-[var(--tx-4)] outline-none backdrop-blur-xl transition-all duration-200 focus:border-[rgba(37,212,255,0.5)] focus:ring-2 focus:ring-[rgba(37,212,255,0.22)]';

/* ── Icon tile ── */
export function GlassIconTile({ icon, tone = 'brand', size = 14 }) {
  const c = TONE[tone] || TONE.brand;
  const px = size * 4;
  return (
    <span className="relative inline-flex items-center justify-center shrink-0 rounded-2xl border border-white/15 overflow-hidden"
      style={{ width: px, height: px, background: `linear-gradient(140deg, ${c}42 0%, ${c}12 100%)`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.30), 0 8px 20px ${c}30` }}
      aria-hidden="true">
      <span className="absolute inset-0 opacity-70" style={{ background: `radial-gradient(circle at 30% 26%, ${c}66, transparent 70%)` }} />
      <GlassIcon name={icon} size={Math.round(px * 0.78)} bare className="relative" />
    </span>
  );
}

/* ── Card / panel ── */
export function GlassCard({ children, className = '', ...props }) {
  return <div {...props} className={'glass-card !rounded-[22px] ' + className}>{children}</div>;
}
export function GlassPanel({ title, action, children, className = '' }) {
  return (
    <div className={'glass-card !rounded-[24px] p-5 ' + className}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {title && <h3 className="font-semibold text-sm text-[var(--tx)]">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
export const GlassChart = GlassPanel; /* chart panels share the panel shell */

export function SectionHeading({ children, action }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3.5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--tx-4)]">{children}</h2>
      {action}
    </div>
  );
}

/* ── Page shell: title + optional toolbar, consistent spacing ── */
export function GlassPage({ title, subtitle, toolbar, children }) {
  return (
    <div className="space-y-6">
      {(title || toolbar) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {title && <h1 className="text-xl font-bold tracking-tight text-[var(--tx)]">{title}</h1>}
            {subtitle && <p className="text-sm text-[var(--tx-4)] mt-0.5">{subtitle}</p>}
          </div>
          {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ── Metric / KPI card ── */
export function GlassMetricCard({ icon, tone = 'brand', label, value, sub, deltaPct, trend, trendKey = 'value', trendLabelKey = 'label', ringPct, href }) {
  const c = TONE[tone] || TONE.brand;
  const Tag = href ? 'a' : 'div';
  const hasDelta = typeof deltaPct === 'number' && isFinite(deltaPct);
  const up = hasDelta ? deltaPct >= 0 : null;
  return (
    <Tag {...(href ? { href } : {})} className={'glass-card group relative overflow-hidden !rounded-[26px] p-5 flex flex-col gap-4' + (href ? ' cursor-pointer' : '')}>
      <div className="flex items-start justify-between gap-3">
        <GlassIconTile icon={icon} tone={tone} size={14} />
        <div className="flex items-center gap-2">
          {ringPct != null && <ProgressRing pct={ringPct} color={c} size={52} />}
          {hasDelta && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ color: up ? '#34D399' : '#F87171', background: up ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', border: `1px solid ${up ? 'rgba(52,211,153,0.30)' : 'rgba(248,113,113,0.30)'}` }}>
              <span aria-hidden="true">{up ? '▲' : '▼'}</span>{Math.abs(deltaPct)}%
            </span>
          )}
        </div>
      </div>
      <div>
        <div className="text-[2rem] leading-none font-bold tracking-tight text-[var(--tx)]">{value}</div>
        <div className="mt-2 text-[13px] font-medium text-[var(--tx-2)]">{label}</div>
        {sub && <div className="mt-0.5 text-[11px] text-[var(--tx-4)]">{sub}</div>}
      </div>
      {trend && <div className="-mx-1 -mb-1 mt-auto"><TrendLine data={trend} dataKey={trendKey} labelKey={trendLabelKey} color={c} height={60} /></div>}
    </Tag>
  );
}

/* ── Buttons ── */
export function GlassButton({ children, variant = 'primary', className = '', ...props }) {
  const v = ['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'ghost'].includes(variant) ? variant : 'primary';
  return <button {...props} className={'af-btn af-btn--' + v + ' ' + className}>{children}</button>;
}

/* Compact glass action pill for table rows — icon + optional text.
   tone: 'cyan' (edit) | 'neutral' (duplicate) | 'red' (delete). */
export function GlassIconButton({ children, label, tone = 'neutral', title, onClick, type = 'button', className = '' }) {
  return (
    <button type={type} title={title} onClick={onClick}
      className={'af-actionbtn af-actionbtn--' + tone + (label ? '' : ' af-actionbtn--icononly') + ' ' + className}>
      {children}{label && <span>{label}</span>}
    </button>
  );
}

/* ── Badges / status chips ── */
export function GlassBadge({ children, tone = 'brand', className = '' }) {
  const c = TONE[tone] || TONE.brand;
  return <span className={'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ' + className} style={{ color: c, background: `${c}1f`, border: `1px solid ${c}45` }}>{children}</span>;
}
export function GlassStatusChip({ label, tone = 'slate', dot = true }) {
  const c = TONE[tone] || TONE.slate;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: c, background: `${c}1a`, border: `1px solid ${c}40` }}>
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />}{label}
    </span>
  );
}

/* ── Quick action tile ── */
export function GlassQuickAction({ icon, tone = 'brand', label, sub, href }) {
  return (
    <a href={href} className="glass-card group !rounded-2xl p-4 flex items-center gap-3 cursor-pointer">
      <GlassIconTile icon={icon} tone={tone} size={11} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[var(--tx)] truncate">{label}</span>
        {sub && <span className="block text-[11px] text-[var(--tx-4)] truncate">{sub}</span>}
      </span>
      <span className="text-[var(--tx-4)] group-hover:text-[var(--pr-2)] transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" aria-hidden="true">→</span>
    </a>
  );
}

/* ── Form controls ── */
export function GlassInput(props) { return <input {...props} className={INPUT + ' ' + (props.className || '')} />; }
export function GlassTextarea(props) { return <textarea rows={3} {...props} className={INPUT + ' ' + (props.className || '')} />; }
export function GlassDatePicker(props) { return <input type="date" {...props} className={INPUT + ' ' + (props.className || '')} />; }
export function GlassSelect({ options = [], ...props }) {
  return <select {...props} className={INPUT + ' cursor-pointer ' + (props.className || '')}>{options.map(o => <option key={String(o.value ?? o)} value={o.value ?? o}>{o.label ?? o}</option>)}</select>;
}
export function GlassField({ label, required, children, className = '' }) {
  return <label className={'block ' + className}><span className="block text-[12px] font-medium text-[var(--tx-3)] mb-1.5">{label}{required && <span className="text-[#F87171]"> *</span>}</span>{children}</label>;
}
export function GlassSearch({ value, onChange, placeholder, className = '' }) {
  return (
    <div className={'relative ' + className}>
      <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-[var(--tx-4)]"><svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.6"/><path d="M20 20l-3.2-3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></span>
      <input value={value} onChange={onChange} placeholder={placeholder} className={INPUT + ' ps-9'} />
    </div>
  );
}

/* ── Dropdown (custom listbox, themeable) ── */
export function GlassDropdown({ value, onChange, options = [], placeholder = 'Select', className = '', disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const norm = options.map(o => (Array.isArray(o) ? { value: o[0], label: o[1] } : (typeof o === 'object' ? o : { value: o, label: o })));
  const sel = norm.find(o => String(o.value) === String(value));
  useEffect(() => {
    function out(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', out); return () => document.removeEventListener('mousedown', out);
  }, []);
  return (
    <div ref={ref} className={'relative ' + className}>
      <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)}
        className={INPUT + ' flex items-center justify-between gap-2 text-start ' + (disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
        <span className={'truncate ' + (sel ? '' : 'text-[var(--tx-4)]')}>{sel ? sel.label : placeholder}</span>
        <span className={'text-[var(--tx-4)] text-xs transition-transform ' + (open ? 'rotate-180' : '')}>▾</span>
      </button>
      {open && (
        <div className="glass-card absolute z-50 start-0 end-0 mt-1 max-h-64 overflow-y-auto !rounded-xl p-1">
          {norm.map(o => (
            <button key={String(o.value)} type="button" onClick={() => { onChange && onChange(o.value); setOpen(false); }}
              className={'w-full text-start px-3 py-2 text-sm rounded-lg transition-colors ' + (String(o.value) === String(value) ? 'text-[var(--pr-2)] bg-[rgba(37,212,255,0.12)] font-semibold' : 'text-[var(--tx-2)] hover:bg-[rgba(37,212,255,0.08)]')}>{o.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Tabs (glass segmented control) ── */
export function GlassTabs({ tabs = [], value, onChange }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border border-[var(--bd-2)] bg-[var(--nav-bg)] backdrop-blur-xl p-1">
      {tabs.map(tb => {
        const v = tb.value ?? tb; const label = tb.label ?? tb; const active = String(v) === String(value);
        return (
          <button key={String(v)} type="button" onClick={() => onChange && onChange(v)}
            className={'rounded-xl px-4 py-1.5 text-sm font-medium transition-all duration-200 ' + (active ? 'text-white' : 'text-[var(--tx-3)] hover:text-[var(--tx)]')}
            style={active ? { background: 'linear-gradient(135deg,#25D4FF,#0EA5E9 55%,#0284C7)', boxShadow: '0 6px 16px rgba(37,212,255,0.35)' } : undefined}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Table ── */
export function GlassTable({ children, className = '' }) {
  return (
    <div className={'glass-card !rounded-[22px] overflow-hidden ' + className}>
      <div className="overflow-x-auto"><table className="w-full">{children}</table></div>
    </div>
  );
}
export function GlassThead({ children }) {
  return <thead className="sticky top-0 z-[1] bg-[rgba(11,34,48,0.55)] backdrop-blur-xl">{children}</thead>;
}
export function GlassTh({ children, className = '' }) {
  return <th className={'text-start px-3.5 py-3 text-[11px] uppercase tracking-[0.08em] text-[var(--tx-4)] font-semibold whitespace-nowrap ' + className}>{children}</th>;
}
export function GlassTr({ children, onClick, className = '' }) {
  return <tr onClick={onClick} className={'border-t border-[var(--bd)] transition-colors hover:bg-[rgba(37,212,255,0.06)] ' + (onClick ? 'cursor-pointer ' : '') + className}>{children}</tr>;
}
export function GlassTd({ children, className = '' }) {
  return <td className={'px-3.5 py-3 text-sm text-[var(--tx-2)] ' + className}>{children}</td>;
}

/* ── Toolbar ── */
export function GlassToolbar({ children, className = '' }) {
  return <div className={'flex flex-wrap items-center gap-2 glass-card !rounded-2xl p-2.5 ' + className}>{children}</div>;
}

/* ── Pagination ── */
export function GlassPagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const btn = 'h-8 min-w-8 px-2 rounded-lg border border-[var(--bd-2)] bg-[var(--nav-bg)] backdrop-blur-xl text-[var(--tx-2)] disabled:opacity-40 hover:border-[rgba(37,212,255,0.4)] hover:text-[var(--pr-2)] transition-colors';
  return (
    <div className="flex items-center justify-between px-1 py-2.5 text-sm text-[var(--tx-4)]">
      <span>{total}</span>
      <div className="flex items-center gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className={btn}>‹</button>
        <span className="text-[var(--tx-2)]">{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className={btn}>›</button>
      </div>
    </div>
  );
}

/* ── Modal / Drawer ── */
export function GlassModal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 lg:p-10">
      <div className="fixed inset-0 bg-[#04101a]/70 backdrop-blur-md" onClick={onClose} />
      <div className={'glass-card relative w-full !rounded-[24px] p-5 lg:p-6 ' + (wide ? 'max-w-3xl' : 'max-w-xl')}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-[var(--tx)]">{title}</div>
          <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-xl border border-[var(--bd-2)] bg-[var(--nav-bg)] backdrop-blur-xl hover:border-[rgba(37,212,255,0.4)] hover:text-[var(--pr-2)] text-[var(--tx-3)] text-lg leading-none transition-colors flex items-center justify-center">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function GlassDrawer({ title, children, onClose, side = 'end' }) {
  const pos = side === 'start' ? 'start-0' : 'end-0';
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[#04101a]/70 backdrop-blur-md" onClick={onClose} />
      <div className={'absolute inset-y-0 ' + pos + ' w-[min(30rem,calc(100vw-2rem))] glass-card !rounded-none !rounded-s-[24px] p-5 overflow-y-auto'}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-[var(--tx)]">{title}</div>
          <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-xl border border-[var(--bd-2)] bg-[var(--nav-bg)] backdrop-blur-xl hover:text-[var(--pr-2)] text-[var(--tx-3)] text-lg leading-none flex items-center justify-center">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Toast / notification ── */
export function GlassToast({ message, tone = 'brand', onClose }) {
  const c = TONE[tone] || TONE.brand;
  return (
    <div className="fixed bottom-5 end-5 z-[60] glass-card !rounded-2xl px-4 py-3 flex items-center gap-3 max-w-sm" role="status">
      <span className="h-2 w-2 rounded-full" style={{ background: c, boxShadow: `0 0 10px ${c}` }} />
      <span className="text-sm text-[var(--tx)] flex-1">{message}</span>
      {onClose && <button onClick={onClose} className="text-[var(--tx-4)] hover:text-[var(--tx)]">×</button>}
    </div>
  );
}
export function GlassNotification({ title, body, time, unread, tone = 'brand', onClick }) {
  const c = TONE[tone] || TONE.brand;
  return (
    <button onClick={onClick} className="w-full text-start px-4 py-3 border-b border-[var(--bd)] hover:bg-[rgba(37,212,255,0.06)] transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-[var(--tx)] truncate">{title}</span>
        {unread && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />}
      </div>
      {body && <div className="text-xs text-[var(--tx-3)] whitespace-pre-line mt-0.5">{body}</div>}
      {time && <div className="text-[11px] text-[var(--tx-4)] mt-0.5">{time}</div>}
    </button>
  );
}

/* ── Empty / loading / skeleton ── */
export function GlassEmptyState({ text, icon = '◇' }) {
  return (
    <div className="py-14 flex flex-col items-center justify-center text-center gap-3">
      <span className="relative inline-flex items-center justify-center h-14 w-14 rounded-2xl border border-white/15 overflow-hidden"
        style={{ background: 'linear-gradient(140deg,#25D4FF42,#25D4FF12)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 20px rgba(37,212,255,0.22)' }}>
        <span className="absolute inset-0 opacity-70" style={{ background: 'radial-gradient(circle at 32% 28%, #36E2FF66, transparent 70%)' }} />
        <span className="relative text-2xl text-[var(--pr-2)]">{icon}</span>
      </span>
      <div className="text-sm text-[var(--tx-4)] max-w-xs">{text}</div>
    </div>
  );
}
export function GlassLoader({ label }) {
  return (
    <div className="py-12 flex flex-col items-center justify-center gap-3 text-[var(--tx-4)]">
      <span className="h-8 w-8 rounded-full border-2 border-[rgba(37,212,255,0.25)] border-t-[#36E2FF] animate-spin" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
export function GlassSkeleton({ className = '' }) {
  return <span className={'block rounded-lg bg-[rgba(37,212,255,0.10)] animate-pulse ' + className} />;
}

/* ── Avatar ── */
export function GlassAvatar({ name, src, size = 36 }) {
  const initial = (name || '?').slice(0, 1).toUpperCase();
  return src
    ? <img src={src} alt={name || ''} className="rounded-full object-cover border border-white/15" style={{ width: size, height: size }} />
    : <span className="inline-flex items-center justify-center rounded-full font-semibold text-[var(--pr-2)] border border-white/15" style={{ width: size, height: size, fontSize: size * 0.4, background: 'linear-gradient(140deg,rgba(37,212,255,0.28),rgba(37,212,255,0.08))' }}>{initial}</span>;
}

/* ── Progress bar ── */
export function GlassProgress({ pct = 0, tone = 'brand', className = '' }) {
  const c = TONE[tone] || TONE.brand;
  const v = Math.max(0, Math.min(100, pct));
  return (
    <span className={'block h-2 w-full rounded-full overflow-hidden bg-[rgba(255,255,255,0.08)] border border-[var(--bd)] ' + className}>
      <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: v + '%', background: `linear-gradient(90deg, ${c}, #36E2FF)`, boxShadow: `0 0 12px ${c}80` }} />
    </span>
  );
}
