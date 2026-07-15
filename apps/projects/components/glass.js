'use client';

/* ═══════════════════════════════════════════════════════════════════════
   Glass* — the shared premium enterprise component system used by every
   page across QuotePro / Projects / TrackFleet. Thin, dependency-free
   wrappers over the token/utility layer in globals.css, so everything
   re-themes centrally and stays visually identical across the suite.
   Re-exports the ui.js primitives under their Glass* names and adds the
   richer surfaces (Card, Badge, Tabs, Toolbar, Skeleton, Toast, IconTile,
   chart theming).
   Mirrored file across all three apps — keep identical.
   ═══════════════════════════════════════════════════════════════════════ */

import { useSyncExternalStore, useCallback } from 'react';
import {
  Button, IconButton, Input, Textarea, Select, Field,
  Modal, EmptyState, Pagination, Th, Td,
} from '@/components/ui';

/* ── Re-exports (canonical Glass* names) ── */
export const GlassButton = Button;
export const GlassIconButton = IconButton;
export const GlassInput = Input;
export const GlassTextarea = Textarea;
export const GlassSelect = Select;
export const GlassField = Field;
export const GlassModal = Modal;
export const GlassEmptyState = EmptyState;
export const GlassPagination = Pagination;
export { Th as GlassTh, Td as GlassTd };

/* ── Card ── */
export function GlassCard({ as: Tag = 'div', pad, flat, className = '', children, ...rest }) {
  const cls = ['glass-card', pad ? 'glass-card--pad' : '', flat ? 'glass-card--flat' : '', className].filter(Boolean).join(' ');
  return <Tag className={cls} {...rest}>{children}</Tag>;
}

/* ── Icon tile ── */
export function IconTile({ size, className = '', children }) {
  const cls = ['icon-tile', size === 'sm' ? 'icon-tile--sm' : size === 'lg' ? 'icon-tile--lg' : '', className].filter(Boolean).join(' ');
  return <span className={cls}>{children}</span>;
}

/* ── Badge (tone-tinted transparent glass) ── */
const BADGE_TONE = {
  neutral: 'text-[color:var(--tx-2)] border-[color:var(--bd-2)] bg-[color:var(--bg-card)]',
  cyan:    'text-[#0b7c93] dark:text-[#67e8f9] border-[rgba(6,182,212,0.4)] bg-[rgba(6,182,212,0.12)]',
  emerald: 'text-[#067a55] dark:text-[#6ee7b7] border-[rgba(16,185,129,0.4)] bg-[rgba(16,185,129,0.12)]',
  amber:   'text-[#a9660a] dark:text-[#fcd34d] border-[rgba(245,158,11,0.42)] bg-[rgba(245,158,11,0.13)]',
  red:     'text-[#c2362f] dark:text-[#fca5a5] border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.12)]',
  violet:  'text-[#6d43c7] dark:text-[#c4b5fd] border-[rgba(139,92,246,0.4)] bg-[rgba(139,92,246,0.12)]',
  slate:   'text-[color:var(--tx-3)] border-[color:var(--bd-2)] bg-[color:var(--bg-card)]',
};
export function GlassBadge({ tone = 'neutral', className = '', children }) {
  return <span className={'gbadge ' + (BADGE_TONE[tone] || BADGE_TONE.neutral) + ' ' + className}>{children}</span>;
}

/* ── Tabs / segmented control ── */
export function GlassTabs({ items = [], value, onChange, className = '' }) {
  return (
    <div className={'gtabs ' + className} role="tablist">
      {items.map(it => {
        const v = typeof it === 'string' ? it : it.value;
        const label = typeof it === 'string' ? it : it.label;
        return (
          <button key={String(v)} role="tab" aria-selected={v === value}
            onClick={() => onChange && onChange(v)}
            className={'gtab' + (v === value ? ' active' : '')}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Toolbar (page action bar) ── */
export function GlassToolbar({ className = '', children }) {
  return <div className={'flex flex-wrap items-center gap-3 ' + className}>{children}</div>;
}

/* ── Skeleton ── */
export function GlassSkeleton({ className = '', style }) {
  return <div className={'gskeleton ' + className} style={style} aria-hidden="true" />;
}
export function GlassSkeletonRows({ rows = 5, cols = 4 }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <GlassSkeleton key={c} className="h-4 flex-1" style={{ opacity: 1 - r * 0.12 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Toast — minimal external store, no context wiring needed. Mount
   <GlassToastHost/> once (in Shell) and call toast(msg, tone) anywhere. ── */
let _toasts = [];
const _subs = new Set();
let _id = 0;
function _emit() { _toasts = _toasts.slice(); _subs.forEach(fn => fn()); }
export function toast(message, tone = 'neutral', ttl = 3200) {
  const id = ++_id;
  _toasts.push({ id, message, tone });
  _emit();
  if (ttl) setTimeout(() => dismissToast(id), ttl);
  return id;
}
export function dismissToast(id) { _toasts = _toasts.filter(t => t.id !== id); _emit(); }
function _subscribe(fn) { _subs.add(fn); return () => _subs.delete(fn); }
function _snapshot() { return _toasts; }

const TOAST_ACCENT = {
  neutral: 'var(--pr)', cyan: '#06b6d4', emerald: '#10b981',
  amber: '#f59e0b', red: '#ef4444',
};
export function GlassToastHost() {
  const items = useSyncExternalStore(_subscribe, _snapshot, () => []);
  const onDismiss = useCallback((id) => dismissToast(id), []);
  if (!items.length) return null;
  return (
    <div className="gtoast-wrap" role="status" aria-live="polite">
      {items.map(t => (
        <div key={t.id} className="gtoast flex items-start gap-3">
          <span className="mt-0.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ background: TOAST_ACCENT[t.tone] || TOAST_ACCENT.neutral }} />
          <div className="flex-1 leading-snug">{t.message}</div>
          <button onClick={() => onDismiss(t.id)} className="text-[color:var(--tx-4)] hover:text-[color:var(--tx)] text-sm leading-none">×</button>
        </div>
      ))}
    </div>
  );
}

/* ── Chart theming helper for recharts (colors read the cyan palette). ── */
export const CHART_COLORS = ['#06B6D4', '#0EA5E9', '#2DD4BF', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#64748B'];
export function chartTheme(dark) {
  return {
    grid: dark ? 'rgba(120,190,230,0.10)' : 'rgba(15,42,64,0.08)',
    axis: dark ? '#8299AE' : '#5B7690',
    tooltip: {
      background: dark ? 'rgba(11,20,36,0.92)' : 'rgba(255,255,255,0.95)',
      border: dark ? '1px solid rgba(120,190,230,0.18)' : '1px solid rgba(15,42,64,0.12)',
      borderRadius: 12,
      backdropFilter: 'blur(16px)',
      color: dark ? '#E8F1F8' : '#0B1B29',
      boxShadow: '0 10px 34px rgba(0,0,0,0.25)',
      fontSize: 12,
    },
    primary: '#06B6D4',
    primarySoft: dark ? 'rgba(34,211,238,0.25)' : 'rgba(6,182,212,0.2)',
  };
}
