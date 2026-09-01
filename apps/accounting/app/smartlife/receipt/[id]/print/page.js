'use client';

/* SmartLife-style receipt voucher — سند قبض (Receipt Voucher) /
   سند قبض نقدي (Cash Receipt Voucher).

   Modelled on the real SmartLife voucher structure (voucher number box,
   amount box, date/branch boxes, amount in words, payment method, the
   "for" line, two signature lines), rebuilt to the same header identity
   and visual language as the invoice documents (InvoiceDocument.js —
   real /logo.png, #006B7A brand rule, same address/CR/VAT/phone/email
   block) so every AL FAROOQUE ERP document reads as one family.

   IMPORTANT CORRECTNESS FIX: the previous version titled every one of
   these documents "سـنـد صــرف / Disbursement Receipt" and labelled the
   counterparty field "Disbursed to Mr/Mrs" — backwards for both SmartERP
   entry types this renders. Both `receipt` and `catch_receipt` post the
   counterparty (customer/account) on the DEBIT side and cash/bank on
   CREDIT, i.e. money coming IN, not going out (verified on a real entry:
   debit = customer account, credit = a cash/fund account, description
   "... سداد جزء من الحساب" — "... partial settlement of the account",
   a collection, not a payment). A receipt/collection voucher is سند قبض,
   not سند صرف. Title and field wording now reflect that, and the two
   entry types get their own distinct title per the ledger's own
   vocabulary (ENTRY_TYPE_LABELS in smartlifeTransactionAdapter.js).

   Every value still comes from the synchronized SmartERP ledger entry
   (/api/smartlife/receipt-document/[id]); the only derived string is the
   amount in words, which spells out that same posted figure. The root
   still carries `.idoc` so the existing server-side Puppeteer renderer
   (lib/pdf/renderPdfServer) renders exactly this sheet — no second
   template, no duplicated data-loading path for View/Print/PDF. */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { INVOICE_COMPANY as ENTITY } from '@/lib/invoiceCompany';

/* The real registered Arabic trade name as it appears on SmartLife's own
   printed voucher — distinct from invoiceCompany.js's generic name_ar
   fallback (used by the sales/purchase invoice header), so kept literal
   here rather than silently substituted. Not a new value: unchanged from
   the prior version, which matched the real SmartLife reference. */
const COMPANY_AR = 'شركة إسماعيل الفاروقي للصناعات الخشبية';

const TITLES = {
  receipt: { ar: 'سند قبض', en: 'Receipt Voucher', enShort: 'Receipt' },
  catch_receipt: { ar: 'سند قبض نقدي', en: 'Cash Receipt Voucher', enShort: 'Cash Receipt' },
};

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
  const title = TITLES[r.entry_type] || TITLES.receipt;

  return (
    <div className="wrap">
      <style>{`
        @page { size: A4 portrait; margin: 14mm; }
        /* !important: this route has no dedicated layout, so it still
           inherits the root layout's globals.css body background rule at
           equal selector specificity — a real bug found by rendering the
           generated PDF to an image: the unstyled remainder of the A4 page
           (the voucher is much shorter than a full page) showed the app's
           grey theme background instead of white. */
        html, body { background: #f1f1ef !important; }
        /* min-height + an opaque background of its own: this route has no
           dedicated layout, so it inherits the root layout's body
           background — verified live that neither an important rule nor
           media-print emulation could override that rule on the body
           element itself (something in globals.css out-specifies it).
           Simplest reliable fix: cover it. .wrap fully controls its own
           pixels, so body's color can never show through the blank
           remainder of an A4-height page below a short voucher. */
        .wrap { padding: 18px; min-height: 100vh; background: #f1f1ef; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
        .idoc { width: 780px; max-width: 100%; margin: 0 auto; background: #fff; padding: 26px 34px 24px;
                border: 1px solid #e2e0da; box-shadow: 0 2px 10px rgba(0,0,0,.06); color: #1a1a18; position: relative; }
        .hdr { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px;
               border-bottom: 3px solid #006B7A; padding-bottom: 12px; }
        .hdr-en, .hdr-ar { font-size: 10.5px; color: #55534c; line-height: 1.55; }
        .hdr-en { text-align: left; }
        .hdr-ar { text-align: right; direction: rtl; }
        .hdr-name-en { font-size: 14px; font-weight: 700; color: #006B7A; margin-bottom: 2px; }
        .hdr-name-ar { font-size: 14px; font-weight: 700; color: #006B7A; margin-bottom: 2px; }
        .hdr-logo { height: 58px; width: auto; }
        .ttl { text-align: center; margin: 16px 0 6px; }
        .ttl-ar { font-size: 21px; font-weight: 700; color: #1857a4; letter-spacing: 4px; direction: rtl; }
        .ttl-en { font-size: 12.5px; font-weight: 700; color: #1857a4; text-transform: uppercase; letter-spacing: 1.5px;
                  border-bottom: 2px solid #1857a4; display: inline-block; padding-bottom: 2px; margin-top: 3px; }
        .vno { text-align: center; color: #d0021b; font-size: 18px; font-weight: 700; letter-spacing: 2px; margin: 6px 0 12px; }
        .boxes { display: flex; justify-content: space-between; gap: 10px; }
        .box { flex: 1; border: 1px solid #cfcdc6; background: #f7f7f5; border-radius: 4px; padding: 6px 10px; text-align: center; }
        .box small { display: block; font-weight: 600; font-size: 8.5px; color: #6e6c64; text-transform: uppercase; letter-spacing: .3px; }
        .box b { display: block; font-size: 13px; font-weight: 700; margin-top: 2px; }
        .fields { margin-top: 18px; }
        .fld { display: grid; grid-template-columns: 150px 1fr 170px; align-items: end; gap: 8px; margin-top: 13px; font-size: 12px; }
        .lbl-ar { direction: rtl; text-align: right; font-weight: 600; order: 3; }
        .lbl-en { color: #33322e; font-weight: 600; order: 1; }
        .val { order: 2; border-bottom: 1px dotted #8a8880; min-height: 18px; padding: 0 6px 2px;
               text-align: center; font-weight: 600; word-break: break-word; }
        .sigs { display: flex; justify-content: space-between; margin-top: 40px; font-size: 11.5px; }
        .sig { width: 44%; text-align: center; }
        .sig .line { border-bottom: 1px dotted #8a8880; height: 22px; margin-bottom: 4px; }
        .sig .ar { direction: rtl; font-weight: 600; }
        .foot { margin-top: 18px; text-align: center; font-size: 8.5px; color: #8c8a80; border-top: 1px solid #e2e0da; padding-top: 6px; }
        .bar { max-width: 780px; margin: 0 auto 12px; display: flex; gap: 8px; justify-content: flex-end; }
        .bar button, .bar a { padding: 7px 16px; border-radius: 8px; border: 1px solid #0f877e; background: #0f877e;
                     color: #fff; font-size: 12px; cursor: pointer; text-decoration: none; }
        .bar .ghost { background: #fff; color: #0f877e; }
        @media print { .bar { display: none !important; } html, body { background: #fff !important; }
          .idoc { box-shadow: none; border: none; padding: 0; width: auto; } .wrap { padding: 0; background: #fff !important; } }
      `}</style>

      {!isPdf && (
        <div className="bar">
          <button type="button" className="ghost" onClick={() => window.print()}>Print</button>
          <button type="button" onClick={downloadPdf} disabled={busy}>{busy ? 'Preparing…' : 'Download PDF'}</button>
        </div>
      )}

      <div className="idoc">
        <div className="hdr">
          <div className="hdr-en">
            <div className="hdr-name-en">{ENTITY.name_en}</div>
            <div>{ENTITY.address_en}</div>
            <div>☎ {ENTITY.phone} · CR: {ENTITY.cr_number}</div>
            <div>VAT: {ENTITY.vat_number}</div>
          </div>
          <img className="hdr-logo" src="/logo.png" alt="" />
          <div className="hdr-ar">
            <div className="hdr-name-ar">{COMPANY_AR}</div>
            <div>{ENTITY.address_ar}</div>
            <div dir="ltr" style={{ textAlign: 'right' }}>{ENTITY.phone} ☎ · {ENTITY.cr_number} :س.ت</div>
            <div dir="ltr" style={{ textAlign: 'right' }}>{ENTITY.vat_number} :الرقم الضريبي</div>
          </div>
        </div>

        <div className="ttl">
          <div className="ttl-ar">{title.ar}</div>
          <div><span className="ttl-en">{title.en}</span></div>
        </div>
        <div className="vno">{voucherNumber(r.reference, r.receipt_number)}</div>

        <div className="boxes">
          <div className="box"><small>ر.س / SAR</small><b>{money4(r.amount)}</b></div>
          <div className="box"><small>التاريخ / Date</small><b>{r.date || ''}</b></div>
          <div className="box"><small>الفرع / Branch</small><b>{r.branch || ''}</b></div>
        </div>

        <div className="fields">
          <Field ar="استـلـم مـن" en="Received From" value={r.debit_account} />
          <Field ar="مبلغ وقدره" en="Amount" value={state.amount_in_words} wide />
          <Field ar="طريقة الدفع" en="Payment Method" value={r.credit_account} />
          <Field ar="وذلك مقابل" en="For" value={r.description} wide />
          <Field ar="مركز التكلفة" en="Cost Center" value={r.cost_center} />
          <Field ar="رقم القيد" en="Entry No." value={r.receipt_number} />
        </div>

        <div className="sigs">
          <div className="sig"><div className="line" /><div className="ar">المستلم</div><div>Recipient</div></div>
          <div className="sig"><div className="line" /><div className="ar">المحاسب</div><div>Accountant</div></div>
        </div>

        <div className="foot">
          {ENTITY.name_en} · CR {ENTITY.cr_number} · VAT {ENTITY.vat_number}<br />
          Source: synchronized SmartERP ledger entry #{r.receipt_id} · values exactly as posted in SmartERP
        </div>
      </div>
    </div>
  );
}
