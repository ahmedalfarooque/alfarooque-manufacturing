/* Tiny inline trend line for stat cards. Only render this where the value
   is backed by a REAL time-series array already returned by the API
   (statusHistory, monthlyMaintenanceCost) — never fabricate a shape for a
   point-in-time number. Uses the SVG `pathLength="1"` normalization trick
   so the CSS draw-in animation (stroke-dashoffset 1 -> 0) doesn't need any
   JS path-length measurement. Data order is oldest -> newest, left -> right,
   in both EN and AR — kept consistent with the dashboard's other (Recharts)
   trend charts on the same page rather than mirrored per-language, so the
   whole dashboard reads with one consistent time axis. */
export default function Sparkline({ data, color = '#6B7A4F', width = 56, height = 22 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = `M${points.join(' L')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="spark-svg" aria-hidden="true" focusable="false">
      <path d={d} pathLength="1" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="spark-path" />
    </svg>
  );
}
