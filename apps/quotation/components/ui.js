'use client';

/* Shared UI primitives — premium glass design system (matches the login
   master + components/glass.js). Export names and signatures are unchanged,
   so every page that already imports these is migrated to the new look with
   no per-page edits. Colours read from the CSS tokens in globals.css so
   light/dark both work. */

export function Button({ children, onClick, type = 'button', variant = 'primary', disabled, className = '' }) {
  const v = ['primary', 'secondary', 'success', 'warning', 'danger', 'info', 'ghost'].includes(variant) ? variant : 'primary';
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={'af-btn af-btn--' + v + ' ' + className}>
      {children}
    </button>
  );
}

const inputCls = 'w-full rounded-xl border border-[var(--bd-2)] bg-white/70 dark:bg-white/[0.05] px-3.5 py-2.5 text-sm text-[var(--tx)] placeholder-[var(--tx-4)] outline-none backdrop-blur-xl transition-all duration-200 focus:border-[rgba(37,212,255,0.5)] focus:ring-2 focus:ring-[rgba(37,212,255,0.22)] focus:bg-white/90 dark:focus:bg-white/[0.08]';

export function Input(props) {
  return <input {...props} className={inputCls + ' ' + (props.className || '')} />;
}

export function Textarea(props) {
  return <textarea rows={3} {...props} className={inputCls + ' ' + (props.className || '')} />;
}

export function Select({ options = [], ...props }) {
  return (
    <select {...props} className={inputCls + ' cursor-pointer ' + (props.className || '')}>
      {options.map(o => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Field({ label, required, children, className = '' }) {
  return (
    <label className={'block ' + className}>
      <span className="block text-[12px] font-medium text-[var(--tx-3)] mb-1.5">{label}{required && <span className="text-[#F87171]"> *</span>}</span>
      {children}
    </label>
  );
}

export function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 lg:p-10">
      <div className="fixed inset-0 bg-[#04101a]/70 backdrop-blur-md" onClick={onClose} />
      <div className={'glass-card relative w-full !rounded-[24px] p-5 lg:p-6 ' + (wide ? 'max-w-3xl' : 'max-w-xl')}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-[var(--tx)]">{title}</div>
          <button onClick={onClose} aria-label="Close"
            className="h-9 w-9 rounded-xl border border-[var(--bd-2)] bg-[var(--nav-bg)] backdrop-blur-xl hover:border-[rgba(37,212,255,0.4)] hover:text-[var(--pr-2)] text-[var(--tx-3)] text-lg leading-none transition-colors flex items-center justify-center">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ text }) {
  return (
    <div className="py-14 flex flex-col items-center justify-center text-center gap-3">
      <span className="relative inline-flex items-center justify-center h-14 w-14 rounded-2xl border border-white/15 overflow-hidden"
        style={{ background: 'linear-gradient(140deg,#25D4FF42,#25D4FF12)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28), 0 8px 20px rgba(37,212,255,0.22)' }}>
        <span className="absolute inset-0 opacity-70" style={{ background: 'radial-gradient(circle at 32% 28%, #36E2FF66, transparent 70%)' }} />
        <span className="relative text-2xl text-[var(--pr-2)]">◇</span>
      </span>
      <div className="text-sm text-[var(--tx-4)] max-w-xs">{text}</div>
    </div>
  );
}

export function Th({ children, className = '' }) {
  return <th className={'text-start px-3.5 py-3 text-[11px] uppercase tracking-[0.08em] text-[var(--tx-4)] font-semibold whitespace-nowrap ' + className}>{children}</th>;
}

export function Td({ children, className = '' }) {
  return <td className={'px-3.5 py-3 text-sm text-[var(--tx-2)] border-t border-[var(--bd)] ' + className}>{children}</td>;
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const btn = 'h-8 min-w-8 px-2 rounded-lg border border-[var(--bd-2)] bg-[var(--nav-bg)] backdrop-blur-xl text-[var(--tx-2)] disabled:opacity-40 hover:border-[rgba(37,212,255,0.4)] hover:text-[var(--pr-2)] transition-colors';
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 text-sm text-[var(--tx-4)]">
      <span>{total}</span>
      <div className="flex items-center gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className={btn}>‹</button>
        <span className="text-[var(--tx-2)]">{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className={btn}>›</button>
      </div>
    </div>
  );
}
