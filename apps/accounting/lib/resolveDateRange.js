'use strict';

/* Turns the { preset, from, to } shape produced by components/DateFilter.js
   into a plain { from, to } ISO-date pair a caller can send straight to a
   local API route as dateFrom/dateTo query params (which then apply
   .gte()/.lte() against the record's real date column server-side).
   Kept as its own tiny file rather than added to DateFilter.js — that
   component is shared/verified elsewhere and is intentionally left alone;
   this only ever imports its already-exported `presetRange`. */

import { presetRange } from '@/components/DateFilter';

export function resolveDateRange(value) {
  if (!value || !value.preset || value.preset === 'all') return { from: null, to: null };
  if (value.preset === 'custom') return { from: value.from || null, to: value.to || null };
  return presetRange(value.preset);
}
