'use client';

import { useMemo, useState } from 'react';

/* Client-side column sorting for the currently-loaded page of rows.
   Works alongside server-side filtering/pagination — this just orders
   whatever rows are already on screen, which is what "click a column
   header to sort" means for a paginated table. Pass a resolver per key
   when the sortable value isn't a plain property (e.g. a nested field
   or a badge that should sort by an underlying number). */
export function useSortableData(rows, resolvers = {}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !rows) return rows;
    const resolve = resolvers[sortKey] || (row => row[sortKey]);
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = resolve(a), bv = resolve(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
    });
    if (sortDir === 'desc') copy.reverse();
    return copy;
  }, [rows, sortKey, sortDir, resolvers]);

  return { sorted, sortKey, sortDir, toggleSort };
}

/* Sortable <th> — click to sort, click again to reverse, shows a ▲/▼
   indicator on the active column. Spread onto a plain <th>. */
export function sortableHeaderProps(key, sortKey, sortDir, toggleSort) {
  return {
    onClick: () => toggleSort(key),
    className: 'cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200 transition',
  };
}
export function SortIndicator({ column, sortKey, sortDir }) {
  if (sortKey !== column) return null;
  return <span className="ml-1 text-brand-500">{sortDir === 'asc' ? '▲' : '▼'}</span>;
}
