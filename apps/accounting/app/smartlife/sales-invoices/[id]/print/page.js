'use client';

/* Print / PDF view for a single SmartLife sales invoice — same pattern as
   apps/quotation/app/(protected)/quotations/[id]/print/page.js: the
   InvoiceDocument below IS the single source of truth, and both "Print"
   and "Download PDF" ask the SERVER to render this exact same URL with a
   real headless Chrome tab (see app/api/smartlife/sales-invoices/[id]/pdf
   and lib/pdf/renderPdfServer.js) — never a client-side rasterizer, so
   preview/print/PDF can never drift apart from each other.

   Deliberately placed OUTSIDE the (protected) route group. Every route
   under apps/accounting/app/(protected)/ is unconditionally wrapped in
   <Shell> by that group's own layout.js (components/Shell.js — the
   QuotePro/Projects/Cars/Inventory/CRM nav, sidebar, theme buttons). A
   Next.js route group's parenthesized segment never appears in the URL,
   so moving this file here does not change the page's path at all —
   /smartlife/sales-invoices/[id]/print resolves exactly the same either
   way — but it now renders with NO Shell ancestor, so there is no
   application chrome to hide with CSS; it was never mounted. Auth is
   unaffected: apps/accounting/middleware.js matches on the URL path
   (`/smartlife/:path*`), not on which route group serves it, and the
   invoice data itself comes from /api/smartlife/sales-invoices, which
   independently requires a session server-side. */

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import InvoiceDocument from '@/components/InvoiceDocument';

const SHEET_W = 794;
const pdfBlobCache = new Map();

async function fetchServerPdfBlob(id, lang) {
  const key = id + ':' + lang;
  const cached = pdfBlobCache.get(key);
  if (cached) return cached;
  const res = await fetch(`/api/smartlife/sales-invoices/${id}/pdf?lang=${lang}`, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Server-side PDF generation unavailable');
  const blob = await res.blob();
  pdfBlobCache.set(key, blob);
  return blob;
}

export default function InvoicePrintPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [lang, setLang] = useState('en');
  const sheetRef = useRef(null);
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [natH, setNatH] = useState(0);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('lang');
      if (q === 'ar' || q === 'en') setLang(q);
    } catch (_) {}
  }, []);

  useEffect(() => {
    /* Exact source-ID lookup. A broad text search for a short numeric ID
       (for example "62") can match hundreds of unrelated totals/codes and
       omit the intended snapshot from the first page. */
    fetch(`/api/smartlife/sales-invoices?id=${encodeURIComponent(id)}&limit=1`, { credentials: 'same-origin' })
      .then(async r => { const body = await r.json().catch(() => null); return r.ok || body?.snapshot_available ? body : null; })
      .then(d => {
        const records = Array.isArray(d?.records) ? d.records : [];
        const found = records.find(r => ['id','invoice_id','reference_no','invoice_number','number','reference'].some(key => String(r?.[key] || '') === String(id)));
        if (!found) { setNotFound(true); return; }
        setInvoice(found);
      })
      .catch(() => setNotFound(true));
  }, [id]);

  useEffect(() => {
    function recalc() {
      const el = sheetRef.current;
      if (!el) return;
      const vv = typeof window !== 'undefined' && window.visualViewport ? window.visualViewport.width : Infinity;
      const winW = typeof window !== 'undefined' ? window.innerWidth : Infinity;
      const wrapW = wrapRef.current ? wrapRef.current.clientWidth : Infinity;
      const available = Math.min(vv, winW, wrapW) - 16;
      setScale(Math.min(1, Math.max(0.32, available / SHEET_W)));
      setNatH(el.offsetHeight || 0);
    }
    recalc();
    const t1 = setTimeout(recalc, 250);
    window.addEventListener('resize', recalc);
    let ro;
    if (typeof ResizeObserver !== 'undefined' && sheetRef.current) {
      ro = new ResizeObserver(recalc);
      ro.observe(sheetRef.current);
    }
    return () => { clearTimeout(t1); window.removeEventListener('resize', recalc); if (ro) ro.disconnect(); };
  }, [invoice, lang]);

  async function downloadPdf() {
    setDownloading(true);
    const filename = (invoice?.reference_no || 'invoice') + '.pdf';
    try {
      const blob = await fetchServerPdfBlob(id, lang);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      window.print();
    } finally {
      setDownloading(false);
    }
  }

  async function printPdf() {
    setPrinting(true);
    const win = window.open('', '_blank');
    try {
      const blob = await fetchServerPdfBlob(id, lang);
      const url = URL.createObjectURL(blob);
      if (win && !win.closed) win.location.href = url;
      else window.open(url, '_blank');
    } catch (e) {
      if (win && !win.closed) win.close();
      window.print();
    } finally {
      setPrinting(false);
    }
  }

  if (notFound) {
    return (
      <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#888', textAlign: 'center' }}>
        <div>{lang === 'ar' ? 'لم يتم العثور على هذه الفاتورة.' : 'This invoice was not found.'}</div>
        <a href="/smartlife/sales-invoices" style={{ color: '#0090A8', display: 'inline-block', marginTop: 12 }}>
          {lang === 'ar' ? '→ العودة' : '← Back'}
        </a>
      </div>
    );
  }
  if (!invoice) return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#888' }}>{lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</div>;

  return (
    <div className="print-stage" style={{ background: '#e9e6e0', minHeight: '100vh', padding: '24px 0' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          html, body { background: #fff !important; color-scheme: light !important; }
          .af-ambient { display: none !important; }
          .print-stage { min-height: 0 !important; padding: 0 !important; background: #fff !important; }
          .print-sheet { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; transform: none !important; }
          .print-sheet-wrap { height: auto !important; overflow: visible !important; transform: none !important; }
        }
        @page { size: A4; margin: 0; }
        .print-toolbar { position: fixed; top: 12px; inset-inline-end: 16px; z-index: 50; display: flex; gap: 8px; font-family: sans-serif; }
        @media (max-width: 640px) {
          .print-toolbar { position: sticky; top: 0; inset-inline-end: auto; inset-inline-start: 0; width: 100%; margin: 0 0 12px; z-index: 60; flex-wrap: wrap; justify-content: center; padding: 8px 10px; background: #e9e6e0; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
          .print-toolbar button, .print-toolbar a { flex: 0 1 auto; font-size: 12px !important; padding: 7px 10px !important; }
        }
        .print-sheet-wrap { display: flex; justify-content: center; overflow-x: hidden; overflow-y: visible; width: 100%; max-width: 100vw; }
      `}</style>

      <div className="no-print print-toolbar">
        <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} style={btn()}>{lang === 'ar' ? 'English' : 'عربي'}</button>
        <button onClick={downloadPdf} disabled={downloading} style={btn(true)}>
          {downloading ? (lang === 'ar' ? 'جارٍ الإنشاء…' : 'Generating…') : (lang === 'ar' ? '⤓ تنزيل PDF' : '⤓ Download PDF')}
        </button>
        <button onClick={printPdf} disabled={printing} style={btn()}>
          {printing ? (lang === 'ar' ? 'جارٍ الإنشاء…' : 'Preparing…') : (lang === 'ar' ? 'طباعة' : 'Print')}
        </button>
        <a href="/smartlife/sales-invoices" style={{ ...btn(), textDecoration: 'none', display: 'inline-block' }}>✕</a>
      </div>

      <div ref={wrapRef} className="print-sheet-wrap" style={{ height: natH ? natH * scale : 'auto' }}>
        <div ref={sheetRef} className="print-sheet" style={{
          background: '#fff', width: SHEET_W, flex: '0 0 auto',
          boxShadow: '0 8px 40px rgba(0,0,0,.18)', borderRadius: 4,
          transform: `scale(${scale})`, transformOrigin: 'top center',
        }}>
          <InvoiceDocument invoice={invoice} lang={lang} />
        </div>
      </div>
    </div>
  );
}

function btn(primary) {
  return {
    padding: '8px 14px', borderRadius: 8, border: '1px solid #ccc', cursor: 'pointer',
    background: primary ? '#006B7A' : '#fff', color: primary ? '#fff' : '#333', fontSize: 13,
  };
}
