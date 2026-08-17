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
      /* A non-2xx response still carries a real body (e.g. `connected:false,
         permission_required:true`) that callers need to render a specific
         state — discarding it and keeping only a string in `error` meant
         any such distinction from a server route was invisible to the UI.
         Surface the body as `data` either way; `error` is reserved for
         cases where the server sent no usable body at all. */
      setData(body);
      setError(res.ok ? null : (body?.error || 'Request failed'));
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
