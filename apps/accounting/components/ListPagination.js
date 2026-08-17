'use client';

/* Shared list-footer pagination control — page-size selector (25/50/100/500,
   default 25) + First/Previous/Next/Last + a filter-aware "Showing X-Y of N"
   line. Mirrors the exact control already verified on the SmartLife generic
   resource page (app/(protected)/smartlife/[resource]/page.js) so every
   Accounting list page looks and behaves identically — that page is not
   touched; this is a new, separate component reused by the local-DB list
   pages (Purchase Requests, Invoices, Bills, Expenses, Payments, Journal
   Entries, Assets, Banking).
   `page` is 1-based, matching every Accounting API route's own convention
   (`page`/`pageSize` query params), unlike SmartLife's 0-based internal page. */

import { GlassButton, GlassSelect } from '@/components/glass';

const PAGE_SIZES = [25, 50, 100, 500];

export default function ListPagination({ page, pageSize, total, onPage, onPageSize, label = 'records' }) {
  if (!total) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = Math.min((page - 1) * pageSize + 1, total);
  const to = Math.min(page * pageSize, total);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--tx-3)]">
        <span>Showing {from}–{to} of {total} {label}</span>
        <span className="flex items-center gap-1.5">Rows per page:
          <GlassSelect value={String(pageSize)} onChange={e => onPageSize(Number(e.target.value))} className="w-20">
            {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </GlassSelect>
        </span>
      </div>
      <div className="flex gap-2">
        <GlassButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(1)}>First</GlassButton>
        <GlassButton variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}>Previous</GlassButton>
        <span className="px-2 text-xs self-center text-[color:var(--tx-3)]">Page {page} of {totalPages}</span>
        <GlassButton variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))}>Next</GlassButton>
        <GlassButton variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPage(totalPages)}>Last</GlassButton>
      </div>
    </div>
  );
}
