export default function StatCard({ icon, label, value, sub, tone, href }) {
  const tones = {
    slate: 'bg-slate-500/10 text-slate-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500',
    brand: 'bg-brand-600/10 text-brand-600 dark:text-brand-400',
    blue: 'bg-blue-500/10 text-blue-500',
  };
  const Tag = href ? 'a' : 'div';
  return (
    <Tag {...(href ? { href } : {})}
      className={
        'rounded-xl border border-[#E5E2DD] dark:border-white/[0.08] bg-white dark:bg-white/[0.05] p-4 flex items-start gap-3 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.07)] dark:shadow-none transition-all duration-200' +
        (href ? ' cursor-pointer hover:border-brand-600/40 hover:-translate-y-0.5 hover:shadow-lg' : '')
      }>
      <div className={'h-10 w-10 rounded-lg flex items-center justify-center text-lg shrink-0 ' + (tones[tone] || tones.slate)}>{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold leading-tight text-[#1A1A18] dark:text-[#F5F3EE]">{value}</div>
        <div className="text-xs text-[#6B6B63] dark:text-[#A8A497] mt-0.5">{label}</div>
        {sub && <div className="text-[11px] text-[#8C8A80] mt-0.5">{sub}</div>}
      </div>
    </Tag>
  );
}
