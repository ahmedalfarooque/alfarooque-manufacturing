'use client';

/* Shared list-footer control — page-size selector (25/50/100/500) plus
   First/Previous/Next/Last pagination — used across every standardized
   list page (Purchase Requests, Orders, Sales Orders, Quotes, Customers,
   Projects, Quotation Approval, and their deleted-record counterparts).
   Extracted once here instead of re-typing the same block per page, so a
   future tweak (e.g. new page-size option) only needs to change one file.
   `total` must already reflect the FILTERED row count, not the whole
   dataset, whenever a filter is active — callers compute that upstream. */

import Dropdown from '@/components/Dropdown';
import { Button } from '@/components/ui';

const DEFAULT_SIZES = ['25', '50', '100', '500'];

export default function ListPager({ page, pageSize, total, shownCount, onPageChange, onPageSizeChange, t, sizes = DEFAULT_SIZES }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = shownCount ? (page - 1) * pageSize + 1 : 0;
  const to = (page - 1) * pageSize + (shownCount || 0);

  return (
    <div className="flex items-center justify-between mt-4 text-sm text-[color:var(--tx-3)] flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <span>{t('common.showingEntries', { from, to, total })}</span>
        <div className="flex items-center gap-1.5">
          <span>{t('common.rows')}</span>
          <Dropdown className="w-20" value={pageSize} onChange={v => onPageSizeChange(Number(v))} options={sizes.map(s => [s, s])} />
        </div>
      </div>
      <div className="flex gap-1 items-center">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(1)} title={t('common.first')}>«</Button>
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} title={t('common.previous')}>‹</Button>
        <span className="px-3 py-1 tabular-nums">{page} / {totalPages}</span>
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} title={t('common.next')}>›</Button>
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} title={t('common.last')}>»</Button>
      </div>
    </div>
  );
}
