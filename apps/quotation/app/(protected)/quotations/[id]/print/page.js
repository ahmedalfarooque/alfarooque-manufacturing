'use client';

/* Print / PDF view — clean white A4 render of the quotation with a
   floating toolbar (hidden when printing). "Download PDF" = the
   browser's print-to-PDF, which renders Arabic + RTL perfectly. */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import QuoteDocument from '@/components/QuoteDocument';

export default function PrintPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [terms, setTerms] = useState(null);
  /* read ?lang= without useSearchParams — avoids the Suspense-boundary
     requirement next build enforces for that hook */
  const [lang, setLang] = useState(null);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('lang');
      if (q === 'ar' || q === 'en') setLang(q);
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetch('/api/quotations/' + id, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(async d => {
        if (!d || !d.row) return;
        setData(d);
        if (!lang) setLang(d.row.output_lang || 'en');
        if (d.row.terms_template_id && !d.row.terms_body_override) {
          const r2 = await fetch('/api/terms/' + d.row.terms_template_id, { credentials: 'same-origin' }).catch(() => null);
          const t2 = r2 && r2.ok ? await r2.json() : null;
          if (t2 && t2.row) setTerms(t2.row);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#888' }}>{lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</div>;

  return (
    <div style={{ background: '#e9e6e0', minHeight: '100vh', padding: '24px 0' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html { background: #fff !important; }
          .print-sheet { box-shadow: none !important; margin: 0 !important; }
        }
        @page { size: A4; margin: 12mm; }
      `}</style>

      <div className="no-print" style={{
        position: 'fixed', top: 12, insetInlineEnd: 16, zIndex: 50, display: 'flex', gap: 8,
        fontFamily: 'sans-serif',
      }}>
        <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          style={btn()}>{lang === 'ar' ? 'English' : 'عربي'}</button>
        <button onClick={() => window.print()} style={btn(true)}>{lang === 'ar' ? '⤓ تنزيل PDF / طباعة' : '⤓ PDF / Print'}</button>
        <a href={'/quotations/' + id} style={{ ...btn(), textDecoration: 'none', display: 'inline-block' }}>✕</a>
      </div>

      <div className="print-sheet" style={{ background: '#fff', maxWidth: 794, margin: '0 auto', boxShadow: '0 8px 40px rgba(0,0,0,.18)', borderRadius: 4 }}>
        <QuoteDocument
          doc={data.row}
          products={data.products}
          entity={data.row.entity_full || data.row.entity}
          customer={data.row.customer}
          terms={terms}
          lang={lang || 'en'}
        />
      </div>
    </div>
  );
}

function btn(primary) {
  return {
    padding: '8px 14px', borderRadius: 8, border: '1px solid #ccc', cursor: 'pointer',
    background: primary ? '#46512F' : '#fff', color: primary ? '#fff' : '#333', fontSize: 13,
  };
}
