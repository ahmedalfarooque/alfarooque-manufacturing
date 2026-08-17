'use client';

/* Shared pagination bar — page-size selector (25/50/100/500, default 25)
   + First/Previous/Next/Last, "Showing X-Y of N". Same markup/behavior as
   the block already shipped on the Products page (kept byte-for-byte
   compatible so Products' own inline copy could be swapped for this
   without changing what users see), now reused by every other Inventory
   list page instead of each hand-rolling its own pager.
   `total` must already reflect whatever filter is active (server-side
   count or client-side filtered length) — this component just renders it. */

import { GlassSelect } from '@/components/glass';

export default function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, t, sizes = [25, 50, 100, 500] }) {
  if (!total) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[color:var(--bd)] text-sm text-[color:var(--tx-3)]">
      <div className="flex items-center gap-3 flex-wrap">
        <span>{t('common.showing', { from: total ? (page - 1) * pageSize + 1 : 0, to: Math.min(page * pageSize, total), total })}</span>
        {onPageSizeChange && (
          <span className="flex items-center gap-1.5">
            <GlassSelect value={String(pageSize)} onChange={e => onPageSizeChange(Number(e.target.value))} className="w-20">
              {sizes.map(s => <option key={s} value={s}>{s}</option>)}
            </GlassSelect>
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onPageChange(1)} className="gbtn gbtn-ghost gbtn--sm">First</button>
        <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="gbtn gbtn-ghost gbtn--sm">{t('common.prev')}</button>
        <span className="px-2 self-center">{page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="gbtn gbtn-ghost gbtn--sm">{t('common.next')}</button>
        <button disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} className="gbtn gbtn-ghost gbtn--sm">Last</button>
      </div>
    </div>
  );
}
