export default function StatCard({ icon, label, value, sub, tone, href }) {
  const tones = {
    slate: 'bg-slate-500/10 text-slate-500',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-500',
    red: 'bg-red-500/10 text-red-500',
    brand: 'bg-brand-500/10 text-brand-500',
    blue: 'bg-blue-500/10 text-blue-500',
  };
  const Tag = href ? 'a' : 'div';
  return (
    <Tag {...(href ? { href } : {})}
      className={
        'rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 flex items-start gap-3' +
        (href ? ' cursor-pointer transition hover:border-brand-500/40 hover:shadow-md' : '')
      }>
      <div className={'h-10 w-10 rounded-lg flex items-center justify-center text-lg shrink-0 ' + (tones[tone] || tones.slate)}>{icon}</div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold leading-tight">{value}</div>
        <div className="text-xs text-slate-500 mt-0.5">{label}</div>
        {sub && <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </Tag>
  );
}
