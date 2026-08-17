'use client';

import { useCallback, useEffect, useState } from 'react';

/* Fetches the COMPLETE result set for a paginated API endpoint (walking
   every server page under the currently active non-date filters), so a
   page can apply a client-side date-range filter + newest-first sort +
   page-size pagination over the full dataset — never just whatever the
   server happened to return for page 1. Polls on `intervalMs` like
   useLiveData, but always re-walks the full set rather than a single page.

   `extraParams` is a plain object of extra query params (search/status/
   warehouse_id/etc, NOT page/limit — those are managed here). Pass a new
   object each render; it's compared by JSON value, not identity. */
export function useAllPages(endpoint, extraParams, arrayKey, { intervalMs = 20000, pageLimit = 100 } = {}) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const paramsKey = JSON.stringify(extraParams || {});

  const refresh = useCallback(async () => {
    const params = JSON.parse(paramsKey);
    const q = new URLSearchParams({ ...params, page: 1, limit: pageLimit });
    const first = await fetch(`${endpoint}?${q}`, { credentials: 'same-origin' }).then(r => r.json()).catch(() => ({}));
    let all = first[arrayKey] || [];
    const totalRows = first.total || all.length;
    const totalPages = Math.ceil(totalRows / pageLimit);
    for (let p = 2; p <= totalPages; p++) {
      q.set('page', p);
      const next = await fetch(`${endpoint}?${q}`, { credentials: 'same-origin' }).then(r => r.json()).catch(() => ({}));
      all = all.concat(next[arrayKey] || []);
    }
    setRows(all);
    setTotal(totalRows);
    setLoading(false);
  }, [endpoint, arrayKey, pageLimit, paramsKey]);

  useEffect(() => {
    refresh();
    if (intervalMs) {
      const id = setInterval(refresh, intervalMs);
      return () => clearInterval(id);
    }
  }, [refresh, intervalMs]);

  return { rows, total, loading, mutate: refresh };
}
