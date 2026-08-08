import { GlassIcon } from './GlassIcons';
import TrendLine from './TrendLine';
import ProgressRing from './ProgressRing';
import MiniBarChart from './MiniBarChart';

const TONE_COLOR = {
  slate: '#64748B',
  emerald: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  brand: '#06B6D4',
  cyan: '#06B6D4',
  blue: '#0EA5E9',
  violet: '#8B5CF6',
  teal: '#2DD4BF',
};

export default function StatCard({ icon, label, value, sub, tone, href, onClick, trend, trendKey = 'value', trendLabelKey = 'label', ringPct, bars, typewriter }) {
  const color = TONE_COLOR[tone] || TONE_COLOR.slate;
  const clickable = href || onClick;
  const Tag = href ? 'a' : onClick ? 'button' : 'div';
  const chartKey = trend ? JSON.stringify(trend) : bars ? bars.values.join(',') : String(ringPct);
  return (
    <Tag {...(href ? { href } : {})} {...(onClick ? { onClick, type: 'button' } : {})}
      className={'glass-card glass-card--pad flex flex-col gap-2 text-start w-full' + (clickable ? ' cursor-pointer' : '')}>
      <span className="icon-tile relative" aria-hidden="true">
        <span className="absolute inset-0.5 rounded-[11px]" style={{ background: `radial-gradient(circle at 35% 25%, ${color}38, transparent 72%)` }} />
        <GlassIcon name={icon} size={38} bare className="relative" />
      </span>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-none tracking-tight text-[color:var(--tx)]">{value}</div>
        <div className="text-[11px] font-medium text-[color:var(--tx-3)] mt-1">{label}</div>
        {sub && (
          <div className="text-[10px] text-[color:var(--tx-4)] mt-0.5">
            {typewriter ? <span key={sub} className="tw-caption">{sub}</span> : sub}
          </div>
        )}
      </div>
      {trend && trend.length >= 2 && (
        <div key={chartKey} className="mt-1.5">
          <TrendLine data={trend} dataKey={trendKey} labelKey={trendLabelKey} color={color} />
        </div>
      )}
      {ringPct != null && !trend && (
        <div key={chartKey} className="mt-1 text-[color:var(--tx)]">
          <ProgressRing pct={ringPct} color={color} />
        </div>
      )}
      {bars && !trend && ringPct == null && (
        <div key={chartKey} className="mt-1.5">
          <MiniBarChart values={bars.values} colors={bars.colors} />
        </div>
      )}
    </Tag>
  );
}
