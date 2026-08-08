import { GlassIcon } from './GlassIcons';
import TrendLine from './TrendLine';
import ProgressRing from './ProgressRing';
import MiniBarChart from './MiniBarChart';

const TONE_COLOR = {
  slate: '#7C9296',
  emerald: '#7FA65C',
  amber: '#E0A238',
  red: '#D9694A',
  brand: '#0C93AE',
  blue: '#3B82F6',
};

/* Premium enterprise stat card — matches the master dashboard mockup:
   a gradient "crystal glass" icon tile top-left, a large value + label +
   sublabel beside it, and the existing mini chart (trend / ring / bars)
   below. Purely presentational — every prop and the data flow are
   unchanged from the previous version, so no dashboard wiring changes. */
export default function StatCard({ icon, label, value, sub, tone, href, trend, trendKey = 'value', trendLabelKey = 'label', ringPct, bars, typewriter }) {
  const color = TONE_COLOR[tone] || TONE_COLOR.slate;
  const Tag = href ? 'a' : 'div';
  const chartKey = trend ? JSON.stringify(trend) : bars ? bars.values.join(',') : String(ringPct);
  return (
    <Tag {...(href ? { href } : {})}
      className={'glass-card glass-card--pad flex flex-col gap-3.5 !p-5' + (href ? ' cursor-pointer' : '')}>
      <div className="flex items-start gap-3.5">
        {/* Crystal-glass gradient icon tile */}
        <span
          className="relative inline-flex items-center justify-center h-12 w-12 shrink-0 rounded-2xl border border-white/15 backdrop-blur-md overflow-hidden"
          style={{
            background: `linear-gradient(140deg, ${color}40 0%, ${color}12 100%)`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 16px ${color}2E`,
          }}
          aria-hidden="true">
          <span className="absolute inset-0 opacity-70" style={{ background: `radial-gradient(circle at 32% 28%, ${color}55, transparent 70%)` }} />
          <GlassIcon name={icon} size={40} bare className="relative" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[1.7rem] font-bold leading-none tracking-tight text-[#122A30] dark:text-[#F4F9FA]">{value}</div>
          <div className="text-[12px] font-medium text-[#41585C] dark:text-[#C9DCDE] mt-1.5">{label}</div>
          {sub && (
            <div className="text-[10px] text-[#7C9296] mt-0.5">
