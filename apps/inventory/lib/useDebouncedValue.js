'use client';

import { useEffect, useState } from 'react';

/* Delays reflecting `value` until it stops changing for `delay` ms.
   Used to debounce search inputs so every keystroke doesn't fire a
   network request — the input itself stays instantly responsive
   (bound directly to local state), only the value fed into the
   fetch/URL is debounced. */
export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
