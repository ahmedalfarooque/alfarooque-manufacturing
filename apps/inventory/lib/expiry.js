'use strict';

/* Shared expiry-tracking logic — license/iqama/passport/medical expiry
   on drivers, insurance/registration expiry on vehicles. One place for
   the day-count math and the green/yellow/orange/red thresholds so the
   dashboard widgets, driver pages, and vehicle pages can never disagree
   about what "expiring soon" means.

   Thresholds (per the brief): >90 days green, 30-90 yellow, 15-30
   orange, <15 (including already expired) red. */

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function expiryLevel(days) {
  if (days == null) return 'none';
  if (days < 15) return 'red';
  if (days < 30) return 'orange';
  if (days <= 90) return 'yellow';
  return 'green';
}

const LEVEL_CLASSES = {
  none: 'bg-slate-500/10 text-slate-500',
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  yellow: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const LEVEL_DOT = { none: '⚪', green: '🟢', yellow: '🟡', orange: '🟠', red: '🔴' };

function expiryInfo(dateStr) {
  const days = daysUntil(dateStr);
  const level = expiryLevel(days);
  let label;
  if (days == null) label = 'Not set';
  else if (days < 0) label = `Expired ${Math.abs(days)}d ago`;
  else if (days === 0) label = 'Expires today';
  else label = `${days}d left`;
  return { days, level, label, className: LEVEL_CLASSES[level], dot: LEVEL_DOT[level] };
}

module.exports = { daysUntil, expiryLevel, expiryInfo, LEVEL_CLASSES, LEVEL_DOT };
