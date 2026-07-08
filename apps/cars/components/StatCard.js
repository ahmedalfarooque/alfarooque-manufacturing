import { GlassIcon } from './GlassIcons';

const TONE_COLOR = {
  slate: '#8C8A80',
  emerald: '#7FA65C',
  amber: '#E0A238',
  red: '#D9694A',
  brand: '#6B7A4F',
  blue: '#3B82F6',
};

export default function StatCard({ icon, label, value, sub, tone, href }) {
  const color = TONE_COLOR[tone] || TONE_COLOR.slate;
  const Tag = href ? 'a' : 'div';
  return (
    <Tag {...(href ? { href } : {})} className={'glass-card glass-card--pad flex flex-col gap-3' + (href ? ' cursor-pointer' : '')}>
      <span className="relative inline-flex items-center justify-center h-9 w-9 shrink-0" aria-hidden="true">
        <span className="absolute -inset-1.5 rounded-full" style={{ background: `radial-gradient(circle, ${color}33, transparent 72%)`, filter: 'blur(3px)' }} />
        <GlassIcon name={icon} size={32} bare className="relative" />
      </span>
      <div className="min-w-0">
        <div className="text-3xl font-bold leading-none tracking-tight text-[#1A1A18] dark:text-[#F5F3EE]">{value}</div>
        <div className="text-xs font-medium text-[#6B6B63] dark:text-[#A8A497] mt-1.5">{label}</div>
        {sub && <div className="text-[11px] text-[#8C8A80] mt-0.5">{sub}</div>}
      </div>
    </Tag>
  );
}
