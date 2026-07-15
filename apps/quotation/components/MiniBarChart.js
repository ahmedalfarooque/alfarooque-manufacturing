'use client';

/* Mini cascading column chart for comparing a few discrete sibling values
   on the same dashboard (e.g. Running/Idle/Stopped counts) — each bar
   grows from the baseline with a staggered start so it reads as a
   left-to-right cascade rather than popping in all at once. Only render
   where every value is a real current count already shown on its own
   card elsewhere on the page. */
export default function MiniBarChart({ values, colors = [], height = 90 }) {
  if (!Array.isArray(values) || values.filter(v => typeof v === 'number' && !isNaN(v)).length < 2) return null;
  const max = Math.max(...values, 1);

  return (
    <div className="flex items-end gap-1.5" style={{ height }} aria-hidden="true">
      {values.map((v, i) => {
        const pct = Math.max(6, (v / max) * 100);
        return (
          <div key={i} className="mbar-bar flex-1 rounded-t-md"
            style={{ '--mbar-h': pct + '%', background: colors[i] || '#0C93AE', animationDelay: (i * 90) + 'ms' }} />
        );
      })}
    </div>
  );
}
