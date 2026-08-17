'use client';

import { useEffect, useState } from 'react';

/* The one QR renderer used by the SmartLife sales-invoice modal, print page,
   and therefore the server-generated PDF. The server endpoint returns the
   authoritative TLV payload and QR image together; this component never
   rebuilds invoice values in the browser. */
export default function ZatcaQr({ invoiceId, size = 132, compact = false }) {
  const [result, setResult] = useState({ status: 'loading' });

  useEffect(() => {
    let active = true;
    setResult({ status: 'loading' });
    if (!invoiceId) {
      setResult({ status: 'unavailable', error: 'Invoice identifier is unavailable.' });
      return () => { active = false; };
    }
    fetch(`/api/smartlife/sales-invoices/${encodeURIComponent(invoiceId)}/zatca`, {
      credentials: 'same-origin', cache: 'no-store',
    })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'ZATCA QR is unavailable.');
        return body;
      })
      .then(body => { if (active) setResult({ status: 'ready', ...body }); })
      .catch(error => { if (active) setResult({ status: 'unavailable', error: error.message }); });
    return () => { active = false; };
  }, [invoiceId]);

  if (result.status !== 'ready') {
    return (
      <div data-zatca-status={result.status} style={{
        width: compact ? size : 'auto', minHeight: compact ? size : 46,
        display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
        border: '1px solid #d8d4cc', borderRadius: 8, padding: 8,
        color: '#6b6b63', background: '#fff', fontSize: 10,
      }}>
        {result.status === 'loading' ? 'Loading ZATCA QR…' : `ZATCA QR unavailable: ${result.error}`}
      </div>
    );
  }

  return (
    <figure data-zatca-status="ready" data-zatca-payload={result.payload} style={{ margin: 0, textAlign: 'center' }}>
      <img className="zatca-qr-image" src={result.dataUrl} alt="ZATCA TLV QR code" width={size} height={size} style={{
        width: size, height: size, display: 'block', padding: 4, background: '#fff',
      }} />
      <figcaption style={{ marginTop: 3, color: '#55534c', fontSize: 10, fontWeight: 600 }}>ZATCA QR</figcaption>
    </figure>
  );
}
