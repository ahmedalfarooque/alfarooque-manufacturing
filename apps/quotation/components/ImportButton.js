'use client';

/* Reusable import control: hidden file input + button + result banner
   rendered via a portal-ish inline message callback. Used by module
   toolbars (suppliers, materials, products handled inline on its page). */

import { useRef, useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { Button } from '@/components/ui';

export default function ImportButton({ endpoint, onDone, label }) {
  const { t } = useLanguage();
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handle(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || t('common.importFailed'));
      onDone && onDone(null, d);
    } catch (e2) { onDone && onDone(e2.message, null); }
    finally { setBusy(false); if (ref.current) ref.current.value = ''; }
  }

  return (
    <>
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handle} />
      <Button variant="ghost" disabled={busy} onClick={() => ref.current && ref.current.click()}>
        {busy ? t('common.importing') : '⇪ ' + (label || t('common.importExcel'))}
      </Button>
    </>
  );
}
