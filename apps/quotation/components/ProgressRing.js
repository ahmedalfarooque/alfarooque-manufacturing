'use client';

/* Circular progress ring for percentage-style stat captions (e.g. "82.8%
   of total"). Sweeps from 0 to the real percentage on mount via an SVG
   stroke-dashoffset animation — only render where a genuine percentage is
   already being shown as text elsewhere on the card. */
export default function ProgressRing({ pct, color = '#6B7A4F', size = 60 }) {
  if (pct == null || isNaN(pct)) return null;
  const clamped = Math.max(0, Math.min(100, pct));
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const target = c - (clamped / 100) * c;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="pring-svg" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="pring-fill" style={{ '--pring-target': target }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="pring-label" fill="currentColor">
        {Math.round(clamped)}%
      </text>
    </svg>
  );
}
