'use client';

/* Shared list-page footer — page-size selector (default 25) plus
   First/Previous/Next/Last controls, matching the ERP-wide list-page
   standardization pattern (reference: Accounting's SmartLife generic
   resource page). Used by every genuine list/table page in Cars
   (Vehicles, Drivers, Maintenance, Maintenance Schedule, Maintenance
   Shops, Alerts) so the pagination UI and behavior stay identical and
   only need fixing in one place.

   `total` must be the count of the CURRENTLY FILTERED dataset (not the
   unfiltered total) — callers already compute this correctly since it's
   the same number driving "Showing X-Y of N". `count` is how many rows
   are on the current page (used for the "to" side of the range). */

export function ListPagination({
  page, pageSize, total, count,
  onPage, onPageSize,
  pageSizeOptions = [10, 25, 50, 100, 500],
  showingLabel, rowsLabel,
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = count ? (page - 1) * pageSize + 1 : 0;
  const to = (page - 1) * pageSize + (count || 0);

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-[color:var(--tx-3)] flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <span>{showingLabel ? showingLabel({ from, to, total }) : `Showing ${from}-${to} of ${total}`}</span>
        {onPageSize && (
          <div className="flex items-center gap-1.5">
            <span>{rowsLabel || 'Rows'}</span>
            <select
              value={pageSize}
              onChange={e => onPageSize(Number(e.target.value))}
              className="ginput w-20"
            >
              {pageSizeOptions.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-1">
        <button disabled={page <= 1} onClick={() => onPage(1)} title="First"
          className="px-2 py-1 rounded disabled:opacity-40 hover:bg-[color:var(--pr-soft)]">«</button>
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} title="Previous"
          className="px-2 py-1 rounded disabled:opacity-40 hover:bg-[color:var(--pr-soft)]">‹</button>
        <span className="px-3 py-1">{page} / {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => onPage(page + 1)} title="Next"
          className="px-2 py-1 rounded disabled:opacity-40 hover:bg-[color:var(--pr-soft)]">›</button>
        <button disabled={page >= totalPages} onClick={() => onPage(totalPages)} title="Last"
          className="px-2 py-1 rounded disabled:opacity-40 hover:bg-[color:var(--pr-soft)]">»</button>
      </div>
    </div>
  );
}
