'use client';

/* SmartLife-style receipt voucher (سند صرف / Disbursement Receipt).

   Modelled on the real SmartLife voucher: bilingual field labels, the amount
   box, the red voucher number, branch and date boxes, amount in words,
   payment method, the "for" line, and the two signature lines. It is NOT the
   generic accounting-table PDF — a receipt is a document, not a report row.

   Every value comes from the synchronized SmartERP ledger entry
   (/api/smartlife/receipt-document/[id]); the only derived string is the
   amount in words, which spells out that same posted figure.

   The root carries `.idoc` because the existing server-side Puppeteer
   renderer (lib/pdf/renderPdfServer) waits for that selector — so Download
   PDF renders exactly this sheet with no second template. */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const COMPANY_AR = 'شركة إسماعيل الفاروقي للصناعات الخشبية';
const COMPANY_EN = 'ALFAROOQUE WOOD WORKS FACTORY';

function money4(value) {
  if (value == null || value === '') return '';
  return Number(value).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

/* SmartLife prints the voucher number zero-padded to ten digits (its own
   display convention for the same reference number). */
function voucherNumber(reference, fallback) {
  const raw = String(reference || fallback || '').trim();
  return /^\d+$/.test(raw) ? raw.padStart(10, '0') : raw;
}

function Field({ ar, en, value, wide }) {
  return (
    <div className="fld">
      <div className="lbl-ar">:{ar}</div>
      <div className="val" style={wide ? { minWidth: 0 } : undefined}>{value || ''}</div>
      <div className="lbl-en">{en}:</div>
    </div>
  );
}

export default function ReceiptVoucherPage() {
  const { id } = useParams();
  const [state, setState] = useState({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const isPdf = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('pdf') === '1';

  useEffect(() => {
    fetch(`/api/smartlife/receipt-document/${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error || 'Could not load the receipt.');
        return body;
      })
      .then(body => setState({ status: 'ready', ...body }))
      .catch(error => setState({ status: 'error', error: error.message }));
  }, [id]);

  async function downloadPdf() {
    setBusy(true);
    try {
      const res = await fetch(`/api/smartlife/receipt-document/${encodeURIComponent(id)}/pdf`, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('unavailable');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `receipt-${id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (_) {
      /* Honest fallback: the print dialog can still save a PDF. */
      window.print();
    } finally { setBusy(false); }
  }

  if (state.status === 'loading') return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#666' }}>Loading receipt…</div>;
  if (state.status === 'error') return <div style={{ padding: 40, fontFamily: 'sans-serif', color: '#b00' }}>{state.error}</div>;

  const r = state.record;
  const isCash = r.entry_type === 'catch_receipt';

  return (
    <div className="wrap">
      <style>{`
        @page { size: A4 portrait; margin: 14mm; }
        html, body { background: #f1f1ef; }
        .wrap { padding: 18px; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
        .idoc { width: 780px; max-width: 100%; margin: 0 auto; background: #fff; padding: 30px 34px 26px;
                border: 1px solid #e2e0da; box-shadow: 0 2px 10px rgba(0,0,0,.06); color: #1a1a18; }
        .top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; gap: 12px; }
        .co { font-size: 15px; font-weight: 700; text-align: center; grid-column: 1 / -1; direction: rtl; }
        .co-en { font-size: 10px; color: #55534c; text-align: center; grid-column: 1 / -1; letter-spacing: .6px; margin-top: 2px; }
        .ttl { text-align: center; margin: 14px 0 4px; }
        .ttl-ar { font-size: 22px; font-weight: 700; color: #1857a4; letter-spacing: 6px; direction: rtl; }
        .ttl-en { font-size: 14px; font-weight: 700; color: #1857a4; border-bottom: 2px solid #1857a4; display: inline-block; padding-bottom: 2px; }
        .vno { text-align: center; color: #d0021b; font-size: 19px; font-weight: 700; letter-spacing: 2px; margin: 8px 0 4px; }
        .boxes { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-top: 4px; }
        .box { border: 1px solid #cfcdc6; background: #f7f7f5; padding: 6px 14px; font-size: 13px; font-weight: 700; min-width: 120px; text-align: center; }
        .box small { display: block; font-weight: 600; font-size: 9px; color: #6e6c64; }
        .fld { display: grid; grid-template-columns: 150px 1fr 160px; align-items: end; gap: 8px; margin-top: 15px; font-size: 12px; }
        .lbl-ar { direction: rtl; text-align: right; font-weight: 600; order: 3; }
        .lbl-en { color: #33322e; font-weight: 600; order: 1; }
        .val { order: 2; border-bottom: 1px dotted #8a8880; min-height: 18px; padding: 0 6px 2px;
               text-align: center; font-weight: 600; word-break: break-word; }
        .sigs { display: flex; justify-content: space-between; margin-top: 46px; font-size: 11.5px; }
        .sig { width: 44%; text-align: center; }
        .sig .line { border-bottom: 1px dotted #8a8880; height: 20px; margin-bottom: 4px; }
        .sig .ar { direction: rtl; font-weight: 600; }
        .foot { margin-top: 22px; text-align: center; font-size: 9px; color: #6e6c64; border-top: 1px solid #e2e0da; padding-top: 7px; }
        .bar { max-width: 780px; margin: 0 auto 12px; display: flex; gap: 8px; justify-content: flex-end; }
        .bar button, .bar a { padding: 7px 16px; border-radius: 8px; border: 1px solid #0f877e; background: #0f877e;
                     color: #fff; font-size: 12px; cursor: pointer; text-decoration: none; }
        .bar .ghost { background: #fff; color: #0f877e; }
        @media print { .bar { display: none !important; } html, body { background: #fff; }
          .idoc { box-shadow: none; border: none; padding: 0; width: auto; } .wrap { padding: 0; } }
      `}</style>

      {!isPdf && (
        <div className="bar">
          <button type="button" className="ghost" onClick={() => window.print()}>Print</button>
          <button type="button" onClick={downloadPdf} disabled={busy}>{busy ? 'Preparing…' : 'Download PDF'}</button>
        </div>
      )}

      <div className="idoc">
        <div className="top">
          <div className="co">{COMPANY_AR}</div>
          <div className="co-en">{COMPANY_EN}</div>
        </div>

        <div className="ttl">
          <div className="ttl-ar">سـنـد صــرف</div>
          <div><span className="ttl-en">{isCash ? 'Cash Disbursement Receipt' : 'Disbursement Receipt'}</span></div>
        </div>
        <div className="vno">{voucherNumber(r.reference, r.receipt_number)}</div>

        <div className="boxes">
          <div className="box"><small>ر.س / SAR</small>{money4(r.amount)}</div>
          <div className="box"><small>التاريخ / Date</small>{r.date || ''}</div>
          <div className="box"><small>الفرع / Branch</small>{r.branch || ''}</div>
        </div>

        <Field ar="يصرف للسيد/السيدة" en="Disbursed to Mr/Mrs" value={r.debit_account} />
        <Field ar="مبلغ وقدره" en="Amount" value={state.amount_in_words} wide />
        <Field ar="طريقة الدفع" en="Payment Method" value={r.credit_account} />
        <Field ar="وذلك مقابل" en="For" value={r.description} wide />
        <Field ar="مركز التكلفة" en="Cost Center" value={r.cost_center} />
        <Field ar="رقم القيد" en="Entry No." value={r.receipt_number} />

        <div className="sigs">
          <div className="sig"><div className="line" /><div className="ar">المستلم</div><div>Recipient</div></div>
          <div className="sig"><div className="line" /><div className="ar">المحاسب</div><div>Accountant</div></div>
        </div>

        <div className="foot">
          {COMPANY_EN} · CR 4031098279 · VAT 312048700900003<br />
          Source: synchronized SmartERP ledger entry #{r.receipt_id} · values exactly as posted in SmartERP
        </div>
      </div>
    </div>
  );
}
