'use client';

/* ═══════════════════════════════════════════════════════════════════════
   CRM-specific presentation widgets, built on top of the shared Glass*
   system (components/glass.js) — reuses existing tokens/classes only,
   introduces no new CSS variables. Used across Dashboard/Contacts/Deals/
   Pipeline/Activities/Reports to give the CRM a single consistent visual
   language.
   ═══════════════════════════════════════════════════════════════════════ */

import Link from 'next/link';
import { GlassCard, IconTile } from '@/components/glass';
import { GlassIcon } from '@/components/GlassIcons';

/* Executive KPI card: thin colored left-accent bar (matches Accounting's
   dashboard KPI treatment) + icon tile + big value + label + optional
   trend/sub. The old version used a blurred glow blob behind the icon,
   which read as a marketing/SaaS-demo card rather than an operational ERP
   metric — replaced with a flat accent bar. */
export function MetricCard({ icon, label, value, sub, tone = 'cyan', className = '' }) {
  return (
    <GlassCard frosted className={'crm-metric relative overflow-hidden ' + className}>
      <span className={'crm-metric-accent crm-metric-accent--' + tone} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[color:var(--tx-3)] truncate">{label}</p>
          <p className="text-2xl font-bold text-[color:var(--tx)] mt-1 tabular-nums">{value}</p>
          {sub && <p className="text-xs text-[color:var(--tx-4)] mt-1">{sub}</p>}
        </div>
        {icon && (
          <IconTile className={'crm-metric-icon crm-metric-icon--' + tone}>
            <GlassIcon name={icon} size={16} />
          </IconTile>
        )}
      </div>
    </GlassCard>
  );
}

/* Section wrapper: title + optional subtitle + optional "View all" action. */
export function SectionCard({ title, subtitle, action, actionHref, className = '', children }) {
  return (
    <GlassCard className={className}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[color:var(--tx-2)] truncate">{title}</h3>
          {subtitle && <p className="text-xs text-[color:var(--tx-4)] mt-0.5">{subtitle}</p>}
        </div>
        {action && actionHref && (
          <Link href={actionHref} className="text-xs font-medium text-[color:var(--pr)] hover:text-[color:var(--pr-2)] whitespace-nowrap shrink-0">
            {action} →
          </Link>
        )}
      </div>
      {children}
    </GlassCard>
  );
}

/* Compact empty-state used inside a SectionCard/GlassCard (no full-page chrome). */
export function CRMEmptyRow({ text }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center gap-1">
      <span className="text-2xl opacity-40" aria-hidden="true">·</span>
      <p className="text-sm text-[color:var(--tx-4)]">{text}</p>
    </div>
  );
}

/* Full-page empty state with an optional action button — for Deals/Pipeline/
   Contacts when the list is genuinely empty. */
export function CRMEmptyState({ title, text, actionLabel, actionHref, onAction }) {
  return (
    <GlassCard className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="icon-tile icon-tile--lg mb-4 opacity-70">
        <GlassIcon name="folder" size={22} />
      </div>
      <h3 className="text-base font-semibold text-[color:var(--tx)]">{title}</h3>
      {text && <p className="text-sm text-[color:var(--tx-4)] mt-1 max-w-sm">{text}</p>}
      {actionLabel && (actionHref || onAction) && (
        actionHref ? (
          <Link href={actionHref} className="gbtn gbtn-primary mt-5">{actionLabel}</Link>
        ) : (
          <button onClick={onAction} className="gbtn gbtn-primary mt-5">{actionLabel}</button>
        )
      )}
    </GlassCard>
  );
}

/* Avatar circle from a name/initial — used in Recent Contacts, Activity feed. */
export function InitialAvatar({ name, size = 32, tone = 'cyan' }) {
  const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      className={'crm-avatar crm-avatar--' + tone}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.4) }}
    >
      {initial}
    </span>
  );
}

/* Vertical timeline row — icon + content + timestamp, for an Activity feed. */
export function TimelineItem({ icon = 'clock', tone = 'cyan', title, meta, time, isLast }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className={'crm-timeline-dot crm-timeline-dot--' + tone}>
          <GlassIcon name={icon} size={13} />
        </span>
        {!isLast && <span className="crm-timeline-line" />}
      </div>
      <div className="flex-1 pb-5 min-w-0">
        <p className="text-sm text-[color:var(--tx)] leading-snug">{title}</p>
        {meta && <p className="text-xs text-[color:var(--tx-4)] mt-0.5 truncate">{meta}</p>}
        {time && <p className="text-[11px] text-[color:var(--tx-4)] mt-0.5">{time}</p>}
      </div>
    </div>
  );
}

/* Slim horizontal bar-distribution row (stage/status breakdown). */
export function DistributionRow({ label, count, max, tone = 'cyan' }) {
  const pct = max > 0 ? Math.max(2, (count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-[color:var(--tx-2)] truncate">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-black/5 dark:bg-white/5 overflow-hidden">
        <div className={'h-full rounded-full crm-bar crm-bar--' + tone} style={{ width: pct + '%' }} />
      </div>
      <span className="w-8 text-end text-[color:var(--tx-3)] tabular-nums">{count}</span>
    </div>
  );
}
