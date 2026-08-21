'use client';

/* Print / PDF view for a single SmartLife purchase — byte-for-byte the same
   architecture as apps/accounting/app/smartlife/sales-invoices/[id]/print,
   reusing the SAME InvoiceDocument template with docType="purchase" so the
   party label reads Supplier instead of Customer and the title reads
   PURCHASE INVOICE. No new template was created — see InvoiceDocument.js. */

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import InvoiceDocument from '@/components/InvoiceDocument';

const SHEET_W = 794;
const pdfBlobCache = new Map();

async function fetchServerPdfBlob(id, lang) {
  const key = id + ':' + lang;
  const cached = pdfBlobCache.get(key);
  if (cached) return cached;
  const res = await fetch(`/api/smartlife/purchases/${id}/pdf?lang=${lang}`, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Server-side PDF generation unavailable');
  const blob = await res.blob();
  pdfBlobCache.set(key, blob);
  return blob;
}

export default function PurchasePrintPage() {
  const { id } = useParams();
  const [purchase, setPurchase] = useState(null);
  const [notFound, setNotFound] = useState(false);
  /* A retrieval failure and a genuinely non-existent purchase are different
     states and must read differently — an accounting user needs to know
     whether to retry or whether the document truly is not there. */
  const [loadError, setLoadError] = useState(null);
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
    /* Resolved via the shared document endpoint (snapshot → SmartERP detail
       → list) instead of a list-only lookup: the previous version reported
       "This purchase was not found." for records SmartERP genuinely has,
       because they were absent from the local snapshot and the list search
       did not surface them. */
    fetch(`/api/smartlife/purchases/${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async r => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok || !body?.record) { setLoadError(body?.error || null); setNotFound(true); return; }
        setPurchase(body.record);
      })
      .catch(() => { setLoadError(null); setNotFound(true); });
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
  }, [purchase, lang]);

  async function downloadPdf() {
    setDownloading(true);
    const filename = (purchase?.reference_no || 'purchase') + '.pdf';
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
        <div>{loadError || (lang === 'ar' ? 'لم يتم العثور على هذه الفاتورة.' : 'This purchase was not found.')}</div>
        {loadError && (
          <button type="button" onClick={() => window.location.reload()}
            style={{ marginTop: 10, padding: '6px 14px', borderRadius: 8, border: '1px solid #0090A8', background: '#fff', color: '#0090A8', cursor: 'pointer' }}>
            {lang === 'ar' ? 'إعادة المحاولة' : 'Retry'}
          </button>
        )}
        <a href="/smartlife/purchases" style={{ color: '#0090A8', display: 'inline-block', marginTop: 12 }}>
          {lang === 'ar' ? '→ العودة' : '← Back'}
        </a>
      </div>
    );
  }
  if (!purchase) return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#888' }}>{lang === 'ar' ? 'جارٍ التحميل…' : 'Loading…'}</div>;

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
        <a href="/smartlife/purchases" style={{ ...btn(), textDecoration: 'none', display: 'inline-block' }}>✕</a>
      </div>

      <div ref={wrapRef} className="print-sheet-wrap" style={{ height: natH ? natH * scale : 'auto' }}>
        <div ref={sheetRef} className="print-sheet" style={{
          background: '#fff', width: SHEET_W, flex: '0 0 auto',
          boxShadow: '0 8px 40px rgba(0,0,0,.18)', borderRadius: 4,
          transform: `scale(${scale})`, transformOrigin: 'top center',
        }}>
          <InvoiceDocument invoice={purchase} lang={lang} docType="purchase" />
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
