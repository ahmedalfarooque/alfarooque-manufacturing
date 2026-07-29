'use client';

/* ═══════════════════════════════════════════════════════════════════════
   Shared UI primitives — premium enterprise glass.
   Every button is TRANSPARENT tinted glass (never a solid fill); text and
   icons stay clearly readable in both themes. Styling is driven by the
   token layer + .gbtn/.ginput/.gmodal classes in globals.css, so these
   primitives re-theme automatically with the design system.
   Signatures are backward-compatible with the previous primitives
   (Button/Input/Textarea/Select/Field/Modal/EmptyState/Th/Td/Pagination);
   new optional props (loading, icon, size, block) are additive.
   Mirrored file: apps/quotation/components/ui.js ·
   apps/projects/components/ui.js · apps/cars/components/ui.js.
   ═══════════════════════════════════════════════════════════════════════ */

const VARIANT_CLASS = {
  primary: 'gbtn-primary',
  secondary: 'gbtn-secondary',
  ghost: 'gbtn-secondary',   // legacy "ghost" was a bordered secondary
  minimal: 'gbtn-ghost',     // truly borderless
  success: 'gbtn-success',
  warning: 'gbtn-warning',
  danger: 'gbtn-danger',
};

export function Button({
  children, onClick, type = 'button', variant = 'primary',
  disabled, loading, icon, size, block, className = '', ...rest
}) {
  const cls = [
    'gbtn',
    VARIANT_CLASS[variant] || VARIANT_CLASS.primary,
    size === 'sm' ? 'gbtn--sm' : size === 'lg' ? 'gbtn--lg' : '',
    block ? 'gbtn--block' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      data-loading={loading ? 'true' : undefined} className={cls} {...rest}>
      {loading && <span className="gbtn-spin" aria-hidden="true" />}
      {!loading && icon}
      {children}
    </button>
  );
}

/* Square icon-only glass button. */
export function IconButton({ children, onClick, type = 'button', variant = 'secondary', size, disabled, className = '', ...rest }) {
  const cls = [
    'gbtn', VARIANT_CLASS[variant] || VARIANT_CLASS.secondary,
    'gbtn--icon', size === 'sm' ? 'gbtn--sm' : '', className,
  ].filter(Boolean).join(' ');
  return <button type={type} onClick={onClick} disabled={disabled} className={cls} {...rest}>{children}</button>;
}

export function Input(props) {
  const { className = '', ...rest } = props;
  return <input {...rest} className={'ginput ' + className} />;
}

export function Textarea(props) {
  const { className = '', rows = 3, ...rest } = props;
  return <textarea rows={rows} {...rest} className={'ginput ' + className} />;
}

export function Select({ options = [], className = '', children, ...props }) {
  return (
    <select {...props} className={'ginput ' + className}>
      {children || options.map(o => <option key={String(o.value)} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Field({ label, required, children, className = '' }) {
  return (
    <label className={'block ' + className}>
      <span className="block text-[12px] font-medium text-[color:var(--tx-3)] mb-1.5">
        {label}{required && <span className="text-[#e0574f]"> *</span>}
      </span>
      {children}
    </label>
  );
}

export function Modal({ title, children, onClose, wide, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 lg:p-10">
      <div className="gmodal-backdrop" onClick={onClose} />
      <div className={'gmodal-panel relative w-full ' + (wide ? 'max-w-3xl' : 'max-w-xl')}>
        <div className="flex items-center justify-between gap-4 px-5 lg:px-6 py-4 border-b border-[color:var(--bd)]">
          <div className="font-semibold text-[15px] text-[color:var(--tx)]">{title}</div>
          <button onClick={onClose} aria-label="Close"
            className="gbtn gbtn-ghost gbtn--icon gbtn--sm text-lg leading-none">×</button>
        </div>
        <div className="px-5 lg:px-6 py-5">{children}</div>
        {footer && (
          <div className="sticky bottom-0 px-5 lg:px-6 py-3.5 border-t border-[color:var(--bd)] bg-[color:var(--nav-bg)] backdrop-blur-xl rounded-b-[22px] flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({ text, icon, action }) {
  return (
    <div className="py-14 flex flex-col items-center justify-center text-center gap-3">
      <span className="icon-tile icon-tile--lg opacity-80">{icon || <span className="text-2xl">✳</span>}</span>
      <div className="text-sm text-[color:var(--tx-3)]">{text}</div>
      {action}
    </div>
  );
}

export function Th({ children, className = '', ...rest }) {
  return (
    <th {...rest} className={'text-start px-3.5 py-3 text-[11px] uppercase tracking-wider text-[color:var(--tx-3)] font-semibold whitespace-nowrap ' + className}>
      {children}
    </th>
  );
}

export function Td({ children, className = '', ...rest }) {
  return (
    <td {...rest} className={'px-3.5 py-3 text-[13px] text-[color:var(--tx)] border-t border-[color:var(--bd)] ' + className}>
      {children}
    </td>
  );
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm text-[color:var(--tx-3)] border-t border-[color:var(--bd)]">
      <span>{total}</span>
      <div className="flex items-center gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)}
          className="gbtn gbtn-secondary gbtn--icon gbtn--sm disabled:opacity-40">‹</button>
        <span className="tabular-nums">{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)}
          className="gbtn gbtn-secondary gbtn--icon gbtn--sm disabled:opacity-40">›</button>
      </div>
    </div>
  );
}
