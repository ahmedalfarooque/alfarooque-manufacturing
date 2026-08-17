export default function ListToolbar({ children, className = '' }) {
  return <div className={`list-toolbar flex flex-wrap items-end gap-3 print:hidden ${className}`}>{children}</div>;
}
