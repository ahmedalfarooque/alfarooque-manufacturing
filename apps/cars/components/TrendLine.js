'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, CartesianGrid, ResponsiveContainer } from 'recharts';

/* Proper in-card trend chart — built on Recharts (already a dependency on
   this dashboard) so the small stat-card charts match the same grid/axis/
   smooth-curve look as the page's bigger chart panels, instead of a bespoke
   hairline SVG. Animates in via Recharts' native area/line reveal — no
   custom stroke-dashoffset plumbing needed. Only render where `data` is a
   REAL time-series array already used elsewhere on this page (never
   fabricated for a point-in-time number). Left-to-right in both EN and AR —
   a chronological time axis, not mirrored per reading direction, matching
   this dashboard's other Recharts trend charts on the same page.
   Recharts' reveal animation is driven by its own JS/SVG internals, not
   CSS, so prefers-reduced-motion has to be checked here rather than via the
   CSS media query used for the bar/ring charts. */
export default function TrendLine({ data, dataKey = 'value', labelKey = 'label', color = '#6B7A4F', height = 96 }) {
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq) setAnimate(!mq.matches);
  }, []);

  const valid = Array.isArray(data) && data.filter(d => typeof d?.[dataKey] === 'number' && !isNaN(d[dataKey])).length >= 2;
  if (!valid) return null;
  const gradId = 'tl-grad-' + color.replace('#', '');

  return (
    <div style={{ height }} dir="ltr" className="text-[#8C8A80] dark:text-[#79766B] -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.18} vertical={false} />
          <XAxis dataKey={labelKey} tick={{ fontSize: 9, fill: 'currentColor' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <Area
            type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5}
            fill={`url(#${gradId})`} dot={false}
            isAnimationActive={animate} animationDuration={1100} animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
