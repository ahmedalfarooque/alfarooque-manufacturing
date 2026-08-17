export default function PageHeader({ title, description, badge, meta, actions }) {
  return <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold text-[color:var(--tx)]">{title}</h1>
        {badge}
      </div>
      {description && <p className="mt-1 text-sm text-[color:var(--tx-3)]">{description}</p>}
      {meta && <div className="mt-1 text-xs text-[color:var(--tx-4)]">{meta}</div>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>;
}
