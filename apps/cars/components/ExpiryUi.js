'use client';

/* Presentation helpers shared by the Insurance, Inspection, Alerts,
   Dashboard and Vehicle pages. Restrained palette on purpose: red =
   expired/critical, orange = urgent, amber = warning/expiring soon, green =
   valid, slate = not set. Indicators are CSS dots, never emoji. All state
   (status, severity, days) arrives pre-computed from the server via
   lib/fleetExpiry.js — nothing here recalculates a date. */

import { useLanguage, trEnum, trExpiryDays } from '@/lib/i18n';

const TONE = {
  red: 'bg-red-500/10 text-red-700 dark:text-red-300 ring-1 ring-inset ring-red-500/25',
  orange: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-1 ring-inset ring-orange-500/25',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-1 ring-inset ring-amber-500/25',
  green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/25',
  slate: 'bg-slate-500/10 text-[color:var(--tx-3)] ring-1 ring-inset ring-slate-500/20',
};
const DOT = { red: '#dc2626', orange: '#ea580c', amber: '#d97706', green: '#059669', slate: '#94a3b8' };

export const STATUS_TONE = { valid: 'green', expiring_soon: 'amber', expired: 'red', missing_date: 'slate', missing_details: 'slate' };
export const SEVERITY_TONE = { critical: 'red', urgent: 'orange', warning: 'amber', expired: 'red', normal: 'green', none: 'slate' };
export const SEVERITY_HEX = { critical: '#dc2626', urgent: '#ea580c', warning: '#d97706', expired: '#7f1d1d', normal: '#059669' };

function Pill({ tone, children, strong }) {
  return (
    <span className={'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] whitespace-nowrap ' + (strong ? 'font-semibold ' : 'font-medium ') + TONE[tone]}>
      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: DOT[tone] }} aria-hidden="true" />
      {children}
    </span>
  );
}

export function StatusPill({ status }) {
  const { t } = useLanguage();
  return <Pill tone={STATUS_TONE[status] || 'slate'} strong={status === 'expired'}>{t('expStatus.' + status)}</Pill>;
}

export function SeverityPill({ severity }) {
  const { t } = useLanguage();
  return <Pill tone={SEVERITY_TONE[severity] || 'slate'} strong={severity === 'critical' || severity === 'expired'}>{t('severity.' + severity)}</Pill>;
}

/* "12d left" / "Expired 3d ago" / "Expires today" / "Not set" — reuses the
   app-wide translated phrasing. */
export function DaysText({ days }) {
  const { t } = useLanguage();
  const tone = days == null ? 'text-[color:var(--tx-4)]' : days < 0 ? 'text-red-600 dark:text-red-400 font-semibold' : days <= 7 ? 'text-red-600 dark:text-red-400 font-semibold' : days <= 15 ? 'text-orange-600 dark:text-orange-400 font-medium' : days <= 30 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-[color:var(--tx-2)]';
  return <span className={'tabular-nums ' + tone}>{trExpiryDays(t, days)}</span>;
}

const VEHICLE_STATUS = {
  Running: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Idle: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Stopped: 'bg-red-500/10 text-red-600 dark:text-red-400',
  Offline: 'bg-slate-500/10 text-[color:var(--tx-3)]',
};
export function VehicleStatusPill({ status }) {
  const { t } = useLanguage();
  if (!status) return <span className="text-[color:var(--tx-4)]">—</span>;
  return <span className={'px-2 py-0.5 rounded-full text-[11px] font-medium ' + (VEHICLE_STATUS[status] || '')}>{trEnum(t, 'status', status)}</span>;
}

/* Email-notification line for a row: whether a daily email is going out
   for this alert, and when the last one was sent. */
export function NotifyLine({ rec, schemaReady }) {
  const { t, formatDateOnly } = useLanguage();
  if (!rec.isActive) return <span className="text-[color:var(--tx-4)]">{t('fleet.noAlert')}</span>;
  if (schemaReady === false) return <span className="text-[11px] text-[color:var(--tx-4)]">{t('fleet.emailUnavailable')}</span>;
  const n = rec.notification || {};
  return (
    <div className="leading-tight">
      <div className="flex items-center gap-1.5 text-[12px]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: n.emailActive ? DOT.green : DOT.slate }} aria-hidden="true" />
        <span className={n.emailActive ? 'text-[color:var(--tx-2)]' : 'text-[color:var(--tx-4)]'}>{n.emailActive ? t('fleet.emailOn') : t('fleet.emailOff')}</span>
      </div>
      <div className="text-[11px] text-[color:var(--tx-4)] mt-0.5">
        {n.deliveryState ? <span className={n.deliveryState === 'failed' ? 'text-red-600 dark:text-red-400 font-medium' : ''}>{t('ns.' + n.deliveryState)}</span> : null}
        {n.lastNotifiedOn ? (n.deliveryState ? ' · ' : '') + t('vd.lastNotified') + ': ' + formatDateOnly(n.lastNotifiedOn) : (!n.deliveryState ? t('fleet.neverNotified') : '')}
      </div>
    </div>
  );
}

/* ── list helpers (filter / search / sort) ── */

/* Sort: missing dates always last. dir 'asc' = soonest/most urgent first. */
export function sortRows(rows, key, dir) {
  const mul = dir === 'desc' ? -1 : 1;
  const val = {
    urgent: r => (r.hasDate ? r.daysRemaining : null),
    days: r => (r.hasDate ? r.daysRemaining : null),
    expiry: r => (r.hasDate ? r.expiryDate : null),
    number: r => String(r.vehicleNumber || ''),
    name: r => String(r.vehicleName || ''),
  }[key] || (r => (r.hasDate ? r.daysRemaining : null));
  return [...rows].sort((a, b) => {
    const x = val(a), y = val(b);
    if (x == null && y == null) return String(a.vehicleNumber).localeCompare(String(b.vehicleNumber));
    if (x == null) return 1;
    if (y == null) return -1;
    if (x < y) return -1 * mul;
    if (x > y) return 1 * mul;
    return String(a.vehicleNumber).localeCompare(String(b.vehicleNumber));
  });
}

export function matchesFilter(row, filter) {
  switch (filter) {
    case 'valid': return row.status === 'valid';
    case 'expiring30': return row.status === 'expiring_soon';
    case 'expired': return row.status === 'expired';
    case 'missing': return row.status === 'missing_date' || !!row.detailsMissing;
    case 'missingDates': return row.status === 'missing_date';
    case 'critical': case 'urgent': case 'warning': return row.isActive && row.severity === filter;
    default: return true;
  }
}

export function matchesSearch(row, q) {
  const s = String(q || '').trim().toLowerCase();
  if (!s) return true;
  return [row.vehicleNumber, row.vehicleName, row.company, row.policyNumber].some(v => v && String(v).toLowerCase().includes(s));
}

export function Notice({ children, tone = 'amber' }) {
  const cls = tone === 'amber' ? 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200' : 'border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200';
  return <div role="status" className={'rounded-xl border px-4 py-3 text-sm ' + cls}>{children}</div>;
}
