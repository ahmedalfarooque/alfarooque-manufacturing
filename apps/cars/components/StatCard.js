export default function StatCard({ icon, label, value, sub, tone, href }) {
  const tones = {
    slate: 'bg-[#6B6B63]/10 text-[#6B6B63]',
    emerald: 'bg-[#7FA65C]/10 text-[#7FA65C]',
    amber: 'bg-[#BC6B4E]/10 text-[#BC6B4E]',
    red: 'bg-[#BC6B4E]/15 text-[#BC6B4E]',
    brand: 'bg-[#6B7A4F]/10 text-[#6B7A4F] dark:text-brand-400',
    blue: 'bg-blue-500/10 text-blue-500',
  };
  const Tag = href ? 'a' : 'div';
  return (
    <Tag {...(href ? { href } : {})}
      className={
        'rounded-xl border border-[#E5E2DD] dark:border-white/10 bg-white dark:bg-white/[0.05] p-4 flex items-start gap-3 shadow-[0_2px_6px_rgba(26,26,24,0.05),0_12px_28px_rgba(26,26,24,0.03)] dark:shadow-none transition-transform duration-200' +
        (href ? ' cursor-pointer hover:-translate-y-0.5 hover:border-[#6B7A4F]/40 hover:shadow-md' : '')
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
