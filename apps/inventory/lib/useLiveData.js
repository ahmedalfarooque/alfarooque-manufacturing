'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/* Polling today, Realtime-ready tomorrow: every consumer just calls
   useLiveData(url, intervalMs) and gets back {data, error, refresh}.
   Swapping the polling loop below for a Supabase Realtime channel
   subscription later only touches this one file — no page has to
   change, since they all depend on this same {data,error,refresh}
   shape regardless of how it's kept fresh. */
export function useLiveData(url, intervalMs) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(url, { credentials: 'same-origin' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Request failed');
      setData(body);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [url]);

  useEffect(() => {
    refresh();
    if (intervalMs) {
      timerRef.current = setInterval(refresh, intervalMs);
      return () => clearInterval(timerRef.current);
    }
  }, [refresh, intervalMs]);

  return { data, error, refresh };
}
