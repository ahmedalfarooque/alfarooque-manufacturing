'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/* Polling today, Realtime-ready tomorrow: every consumer just calls
   useLiveData(url, intervalMs) and gets back {data, error, refresh}.
   Swapping the polling loop below for a Supabase Realtime channel
   subscription later only touches this one file — no page has to
   change, since they all depend on this same {data,error,refresh}
   shape regardless of how it's kept fresh.

   Perf behavior (visually invisible, saves real work):
   - identical responses don't call setData, so an unchanged poll
     never re-renders the consuming page (tables, dashboards);
   - polls are skipped while the tab is hidden and one fires
     immediately when the user returns, so background tabs cost
     nothing without ever showing stale data;
   - overlapping fetches are prevented (a slow response can't stack
     up behind the next interval tick). */
export function useLiveData(url, intervalMs) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const lastRawRef = useRef(null);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      const raw = await res.text();
      let body;
      try { body = JSON.parse(raw); } catch { body = {}; }
      if (!res.ok) throw new Error(body.error || 'Request failed');
      if (raw !== lastRawRef.current) {
        lastRawRef.current = raw;
        setData(body);
      }
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      inFlightRef.current = false;
    }
  }, [url]);

  useEffect(() => {
    lastRawRef.current = null;
    refresh();
    if (!intervalMs) return;
    timerRef.current = setInterval(() => {
      if (!document.hidden) refresh();
    }, intervalMs);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, intervalMs]);

  return { data, error, refresh };
}
