'use client';

/* Print / PDF view — clean white A4 render of the quotation with a
   floating toolbar (hidden when printing).
   - The QuoteDocument below IS the single source of truth. "Download
     PDF" and "Print" both ask the SERVER to print this exact same URL
     with a real headless Chrome tab (app/api/quotations/[id]/pdf,
     lib/pdf/renderPdfServer.js) — not a client-side DOM-to-canvas
     rasterizer. A from-scratch CSS re-implementation (html2canvas) could
     not reliably reproduce this document's CSS Grid header, custom
     Arabic web fonts, and RTL layout — real Chrome printing the real
     page has no such gap, since it's the exact same engine already
     rendering the preview.
   - A manual Ctrl+P still falls back to this page's own print
     stylesheet (kept below) as a safety net, and if the server-side
     renderer is unavailable in this environment (e.g. no local Chrome/
     Edge install found), both buttons fall back to the previous
     client-side html2canvas pipeline so the feature still works. */

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import QuoteDocument, { money, dateStr } from '@/components/QuoteDocument';
import { downloadQuotePdf, printQuotePdf } from '@/lib/pdf/buildQuotePdf';
import { buildQuoteQrText, buildQuoteQrDataUrl } from '@/lib/qr';

/* Mobile viewport fix only — the actual PDF/print output is untouched:
   both the server route (renderPdfServer.js, Puppeteer @900px viewport)
   and the html2canvas fallback below capture the document at its real
   794px size regardless of what the visitor's phone screen looks like.
   This is purely a "shrink the on-screen preview to fit the phone"
   transform so nothing overflows the viewport or requires horizontal
   scrolling — desktop (where 794px already fits) renders at scale(1),
   i.e. pixel-identical to before. */
const SHEET_W = 794;

async function fetchServerPdfBlob(id, lang) {
  const res = await fetch(`/api/quotations/${id}/pdf?lang=${lang}`, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Server-side PDF generation unavailable');
  return res.blob();
}

export default function PrintPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [terms, setTerms] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const sheetRef = useRef(null);
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [natH, setNatH] = useState(0);
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
        /* Fall back to the quotation's own output language ONLY when the
           URL didn't explicitly request one. Checked against the URL
           directly, NOT the `lang` state: this callback's closure captured
           lang from the initial render (null), so `if (!lang)` was true
           even after the ?lang= effect had already set it — clobbering an
           explicit ?lang=ar with output_lang. That race is exactly why the
           server-side PDF endpoint (which always passes ?lang=) kept
           producing the English document from the Arabic button. */
        const urlLang = (() => {
          try { return new URLSearchParams(window.location.search).get('lang'); } catch (_) { return null; }
        })();
        if (urlLang !== 'ar' && urlLang !== 'en') setLang(d.row.output_lang || 'en');
        if (d.row.terms_template_id && !d.row.terms_body_override) {
          const r2 = await fetch('/api/terms/' + d.row.terms_template_id, { credentials: 'same-origin' }).catch(() => null);
          const t2 = r2 && r2.ok ? await r2.json() : null;
          if (t2 && t2.row) setTerms(t2.row);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* QR is language-aware and rebuilt only when the underlying data or
     the toggled language actually changes — a cancelled-flag guards
     against a stale async result overwriting a newer one (no duplicate
     or out-of-order regeneration). */
  useEffect(() => {
    if (!data || !lang) return;
    let cancelled = false;
    const entity = data.row.entity_full || data.row.entity;
    const customer = data.row.customer;
    const isAr = lang === 'ar';
    const pick = (row, base) => row && (isAr ? (row[base + '_ar'] || row[base + '_en']) : (row[base + '_en'] || row[base + '_ar']));
    const entityName = isAr ? (entity?.name_ar || entity?.name_en) : (entity?.name_en || entity?.name_ar);
    const customerName = customer ? (pick(customer, 'company_name') || customer.company_name) : '';
    const text = buildQuoteQrText(lang, {
      entityName, customerName,
      quoteNumber: data.row.quote_number,
      quoteDate: dateStr(data.row.quote_date),
      validUntil: dateStr(data.row.valid_until),
      grandTotal: money(data.row.grand_total),
      currency: isAr ? 'ر.س' : 'SAR',
      phone: entity?.phone, email: entity?.email, website: entity?.website,
    });
    buildQuoteQrDataUrl(text).then(url => { if (!cancelled) setQrDataUrl(url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [data, lang]);

  /* Shrink-to-fit the fixed-width (794px) sheet on narrow screens so it
     never forces horizontal scrolling. Recomputed on resize and whenever
     the document's own height changes (language toggle can reflow it,
     e.g. Arabic line-wrapping). Desktop viewports (>= ~810px available)
     always resolve to scale 1 — pixel-identical to the un-scaled page. */
  useEffect(() => {
    function recalc() {
      const el = sheetRef.current;
      if (!el) return;
      const available = (wrapRef.current ? wrapRef.current.clientWidth : window.innerWidth) - 16;
      setScale(Math.min(1, Math.max(0.32, available / SHEET_W)));
      setNatH(el.offsetHeight || 0);
    }
    recalc();
    window.addEventListener('resize', recalc);
    let ro;
    if (typeof ResizeObserver !== 'undefined' && sheetRef.current) {
      ro = new ResizeObserver(recalc);
      ro.observe(sheetRef.current);
    }
    return () => { window.removeEventListener('resize', recalc); if (ro) ro.disconnect(); };
  }, [data, lang, qrDataUrl]);

  /* The .qdoc element mounted below — literally the on-screen preview
     — is what gets captured. Not data passed to a second renderer. The
     capture always happens at scale(1): the mobile shrink-to-fit above
     is a pure preview convenience and must never leak into the actual
     PDF/print output, so it's forced back to 1 for the instant of
     capture (the server route ignores it entirely — it renders the URL
     in its own fixed-size headless Chrome tab — this only matters for
     the client-side html2canvas fallback path). */
  function getDocEl() {
    return sheetRef.current && sheetRef.current.querySelector('.qdoc');
  }

  async function withUnscaledCapture(fn) {
    const prevScale = scale;
    if (prevScale !== 1) {
      setScale(1);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    try {
      return await fn();
    } finally {
      if (prevScale !== 1) setScale(prevScale);
    }
  }

  async function downloadPdf() {
    setDownloading(true);
    const filename = (data.row.quote_number || 'quotation') + '.pdf';
    try {
      const blob = await fetchServerPdfBlob(id, lang || 'en');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (_) {
      try {
        await withUnscaledCapture(() => downloadQuotePdf(getDocEl(), filename));
      } catch (_) {
        window.print();
      }
    } finally {
      setDownloading(false);
    }
  }

  async function printPdf() {
    setPrinting(true);
    try {
      const blob = await fetchServerPdfBlob(id, lang || 'en');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (_) {
      try {
        await withUnscaledCapture(() => printQuotePdf(getDocEl()));
      } catch (_) {
        window.print();
      }
    } finally {
      setPrinting(false);
    }
  }

  if (!data) return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#888' }}>{lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</div>;

  return (
    <div className="print-stage" style={{ background: '#e9e6e0', minHeight: '100vh', padding: '24px 0' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html { background: #fff !important; }
          /* The grey on-screen stage must contribute NOTHING to the
             printed page: its min-height:100vh resolves against the
             PRINT page box (297mm) when printing, and together with its
             24px padding it inflated every generated PDF past one A4
             page — the "oversized page with blank space after the
             footer" bug. Zero it all out for print. */
          .print-stage { min-height: 0 !important; padding: 0 !important; background: #fff !important; }
          .print-sheet { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; transform: none !important; }
          .print-sheet-wrap { height: auto !important; overflow: visible !important; }
        }
        /* Zero browser page margin — the document itself supplies its
           own 32px/36px padding (~8.5mm) as the visible A4 margin, and
           its content width (794px) already equals true A4 width at
           96dpi, so nothing gets scaled or clipped by a second,
           conflicting page margin.
           Deliberately no size: value here (page size is controlled
           purely from the server-side page.pdf() call now, see
           renderPdfServer.js) — declaring size: A4 on this rule caused
           a real, reproducible Chrome bug: whenever the requested custom
           page.pdf({width, height}) had width > height (any quotation
           shorter than 210mm), Chrome silently SWAPPED the two
           dimensions in the output PDF, as if "correcting" back to the
           orientation implied by the CSS-declared A4 size. Confirmed by
           direct testing: identical width/height values produced a
           correctly-oriented PDF with this size:A4 declaration removed,
           and a swapped one with it present. */
        @page { margin: 0; }

        /* ═══ Mobile toolbar — desktop keeps the original fixed
           top-right cluster untouched; below 640px it becomes a
           sticky, full-width, wrapping row instead of floating over
           the document (which is what caused the QR/header overlap
           and oversized buttons on phones). ═══ */
        .print-toolbar {
          position: fixed; top: 12px; inset-inline-end: 16px; z-index: 50;
          display: flex; gap: 8px; font-family: sans-serif;
        }
        @media (max-width: 640px) {
          .print-toolbar {
            position: sticky; top: 0; inset-inline-end: auto; inset-inline-start: 0;
            width: 100%; margin: 0 0 12px; z-index: 60;
            flex-wrap: wrap; justify-content: center;
            padding: 8px 10px; background: #e9e6e0;
            box-shadow: 0 2px 8px rgba(0,0,0,.08);
          }
          .print-toolbar button, .print-toolbar a {
            flex: 0 1 auto; font-size: 12px !important; padding: 7px 10px !important;
          }
        }
        .print-sheet-wrap { display: flex; justify-content: center; overflow: hidden; }
      `}</style>

      <div className="no-print print-toolbar">
        <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
          style={btn()}>{lang === 'ar' ? 'English' : 'عربي'}</button>
        <button onClick={downloadPdf} disabled={downloading} style={btn(true)}>
          {downloading ? (lang === 'ar' ? 'جارٍ الإنشاء…' : 'Generating…') : (lang === 'ar' ? '⤓ تنزيل PDF' : '⤓ Download PDF')}
        </button>
        <button onClick={printPdf} disabled={printing} style={btn()}>
          {printing ? (lang === 'ar' ? 'جارٍ الإنشاء…' : 'Preparing…') : (lang === 'ar' ? 'طباعة' : 'Print')}
        </button>
        <a href={'/quotations/' + id} style={{ ...btn(), textDecoration: 'none', display: 'inline-block' }}>✕</a>
      </div>

      <div ref={wrapRef} className="print-sheet-wrap no-print-wrap" style={{ height: natH ? natH * scale : 'auto' }}>
        <div ref={sheetRef} className="print-sheet" style={{
          background: '#fff', width: SHEET_W, flex: '0 0 auto',
          boxShadow: '0 8px 40px rgba(0,0,0,.18)', borderRadius: 4,
          transform: `scale(${scale})`, transformOrigin: 'top center',
        }}>
          <QuoteDocument
            doc={data.row}
            products={data.products}
            entity={data.row.entity_full || data.row.entity}
            customer={data.row.customer}
            terms={terms}
            lang={lang || 'en'}
            qrDataUrl={qrDataUrl}
          />
        </div>
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
