'use client';

/* Small shared UI primitives, styled with the same tokens Shell uses. */

export function Button({ children, onClick, type = 'button', variant = 'primary', disabled, className = '' }) {
  const styles = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm',
    ghost: 'border border-[#E5E2DD] dark:border-white/[0.08] hover:bg-[#F1EEE7] dark:hover:bg-white/5',
    danger: 'bg-[#BC6B4E]/10 text-[#BC6B4E] border border-[#BC6B4E]/30 hover:bg-[#BC6B4E]/20',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={'rounded-lg px-3.5 py-2 text-sm font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ' + (styles[variant] || styles.primary) + ' ' + className}>
      {children}
    </button>
  );
}

const inputCls = 'w-full rounded-lg border border-[#E5E2DD] dark:border-white/[0.1] bg-white dark:bg-white/5 px-3 py-2 text-sm outline-none focus:border-brand-600 dark:focus:border-brand-400 transition-colors';

export function Input(props) {
  return <input {...props} className={inputCls + ' ' + (props.className || '')} />;
}

export function Textarea(props) {
  return <textarea rows={3} {...props} className={inputCls + ' ' + (props.className || '')} />;
}

export function Select({ options = [], ...props }) {
  return (
    <select {...props} className={inputCls + ' ' + (props.className || '')}>
      {options.map(o => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Field({ label, required, children, className = '' }) {
  return (
    <label className={'block ' + className}>
      <span className="block text-[12px] text-[#8C8A80] mb-1">{label}{required && <span className="text-[#BC6B4E]"> *</span>}</span>
      {children}
    </label>
  );
}

export function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 lg:p-10">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className={'glass-card relative w-full bg-white dark:bg-[#1B1B14] p-5 lg:p-6 shadow-2xl ' + (wide ? 'max-w-3xl' : 'max-w-xl')}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold">{title}</div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-[#F1EEE7] dark:hover:bg-white/5 text-lg leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ text }) {
  return <div className="py-12 text-center text-sm text-[#8C8A80]">{text}</div>;
}

export function Th({ children, className = '' }) {
  return <th className={'text-start px-3 py-2.5 text-[11px] uppercase tracking-wider text-[#8C8A80] font-medium whitespace-nowrap ' + className}>{children}</th>;
}

export function Td({ children, className = '' }) {
  return <td className={'px-3 py-2.5 text-sm border-t border-[#E5E2DD]/70 dark:border-white/[0.06] ' + className}>{children}</td>;
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-3 py-2 text-sm text-[#8C8A80]">
      <span>{total}</span>
      <div className="flex items-center gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="px-2 py-1 rounded disabled:opacity-40 hover:bg-[#F1EEE7] dark:hover:bg-white/5">‹</button>
        <span>{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="px-2 py-1 rounded disabled:opacity-40 hover:bg-[#F1EEE7] dark:hover:bg-white/5">›</button>
      </div>
    </div>
  );
}
