/* Pure presentational quotation document (A4-friendly), used by the
   internal print view AND the public /q/[token] page — so it must work
   as a server component: no hooks, no app i18n context. Labels come
   from an embedded bilingual dictionary keyed by `lang` ('en'|'ar').
   Layout mirrors the company's Excel quotation format:
   header → customer block → items table → totals → terms → signature. */

const L = {
  en: {
    quotation: 'QUOTATION', costEstimation: 'Quotation / Cost Estimation',
    number: 'Quotation No.', date: 'Date', validUntil: 'Valid Until',
    customer: 'Customer', contact: 'Contact', phone: 'Phone',
    item: '#', description: 'DESCRIPTION', qty: 'QTY', unit: 'UNIT',
    unitPrice: 'UNIT PRICE', taxable: 'VAT', amount: 'AMOUNT (SAR)',
    subtotal: 'SUBTOTAL', discount: 'Discount', net: 'NET TOTAL',
    vat: 'VAT', grandTotal: 'GRAND TOTAL', currency: 'SAR',
    paymentTerms: 'Payment Terms', deliveryTerms: 'Delivery Terms',
    notes: 'Notes', terms: 'Terms & Conditions',
    preparedBy: 'Prepared by', approvedBy: 'Approved by', customerSign: 'Customer Acceptance',
    cr: 'CR', vatNo: 'VAT No.', yes: 'T', no: '—',
    bankDetails: 'Bank Details', bank: 'Bank', accountNumber: 'Account Number', iban: 'IBAN', accountName: 'Account Name',
    page: 'Page', of: 'of', website: 'Web', scanToVerify: 'Scan to verify',
  },
  ar: {
    quotation: 'عرض سعر', costEstimation: 'عرض سعر / تقدير تكلفة',
    number: 'رقم العرض', date: 'التاريخ', validUntil: 'صالح حتى',
    customer: 'العميل', contact: 'المسؤول', phone: 'الجوال',
    item: '#', description: 'الوصف', qty: 'الكمية', unit: 'الوحدة',
    unitPrice: 'سعر الوحدة', taxable: 'ضريبة', amount: 'المبلغ (ر.س)',
    subtotal: 'المجموع', discount: 'الخصم', net: 'الصافي',
    vat: 'ضريبة القيمة المضافة', grandTotal: 'الإجمالي النهائي', currency: 'ر.س',
    paymentTerms: 'شروط الدفع', deliveryTerms: 'شروط التسليم',
    notes: 'ملاحظات', terms: 'الشروط والأحكام',
    preparedBy: 'إعداد', approvedBy: 'اعتماد', customerSign: 'موافقة العميل',
    cr: 'س.ت', vatNo: 'الرقم الضريبي', yes: 'نعم', no: '—',
    bankDetails: 'التفاصيل البنكية', bank: 'البنك', accountNumber: 'رقم الحساب', iban: 'الآيبان', accountName: 'اسم الحساب',
    page: 'صفحة', of: 'من', website: 'الموقع', scanToVerify: 'امسح للتحقق',
  },
};

/* Fixed bank-account block shown on every quotation, verbatim per company
   instruction — not entity-specific, not user-editable. */
const BANK_DETAILS = {
  bank: 'Alinma Bank',
  accountNumber: '68205594739000',
  iban: 'SA5105000068205594739000',
  accountName: 'Ismail Al Farooque Wooden Industries',
};

import { translate, hasArabic } from '@/lib/translate';

/* translate() is a word-by-word, order-reversing NAME translator (correct
   for short noun phrases like "Premium MDF Door"). Applying it to
   multi-sentence prose (Terms & Conditions, Payment/Delivery Terms,
   Notes) scrambles it into nonsense. For those long-form fields we only
   ever substitute a handful of KNOWN, hand-translated sentences (the
   shared default templates); anything else is shown in its original
   script rather than run through the word-reversal heuristic. */
const PROSE_PAIRS = [
  [
    'Prices are valid for 7 days from the quotation date. Delivery period to be confirmed on order. Prices include VAT where stated.',
    'الأسعار سارية لمدة 7 أيام من تاريخ العرض. يتم تأكيد مدة التسليم عند الطلب. الأسعار تشمل الضريبة حيثما ذُكر.',
  ],
];
function locProse(v, isAr) {
  const s = v === null || v === undefined ? '' : String(v);
  if (!s.trim()) return s;
  if (isAr === hasArabic(s)) return s;
  const norm = s.trim().replace(/\s+/g, ' ');
  const hit = PROSE_PAIRS.find(([en, ar]) => (isAr ? en : ar).replace(/\s+/g, ' ') === norm);
  return hit ? (isAr ? hit[1] : hit[0]) : s;
}

export function money(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function dateStr(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB'); } catch (_) { return String(d); }
}

/* Splits the company name onto two header lines. "AL FAROOQUE" /
   "ALFAROOQUE" is treated as the brand line with everything else
   (the division name, e.g. "WOOD WORKS FACTORY") on line 2 — matching
   this company's actual naming pattern exactly, spelled however it's
   actually stored (no casing/spacing invented). Any other entity name
   (including Arabic) falls back to a balanced word-count split so a
   future/unknown entity name still wraps sensibly onto two lines. */
function splitCompanyName(name) {
  const s = String(name || '').trim();
  if (!s) return ['', ''];
  const brandMatch = s.match(/^(al\s?farooque)(\s+)(.+)$/i);
  if (brandMatch) return [brandMatch[1], brandMatch[3]];
  const words = s.split(/\s+/);
  if (words.length <= 1) return [s, ''];
  let bestIdx = Math.ceil(words.length / 2), bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const diff = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return [words.slice(0, bestIdx).join(' '), words.slice(bestIdx).join(' ')];
}

export default function QuoteDocument({ doc, products, entity, customer, terms, lang, qrDataUrl }) {
  const isAr = lang === 'ar';
  const t = L[isAr ? 'ar' : 'en'];
  const dir = isAr ? 'rtl' : 'ltr';
  const eName = isAr ? (entity?.name_ar || entity?.name_en) : (entity?.name_en || entity?.name_ar);
  const eAddr = isAr ? (entity?.address_ar || entity?.address_en) : (entity?.address_en || entity?.address_ar);
  /* Single-language data model: localize stored values to the document
     language (passthrough when the script already matches). */
  const loc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    if (!s.trim()) return s;
    return (isAr === hasArabic(s)) ? s : translate(s, isAr ? 'ar' : 'en');
  };
  /* Stored-bilingual pick (v6 model): prefer the saved *_en/*_ar pair;
     legacy rows without the pair fall back to the localized canonical. */
  const pick = (row, base) => (isAr
    ? (row[base + '_ar'] || row[base + '_en'])
    : (row[base + '_en'] || row[base + '_ar']));
  const cName = customer ? (pick(customer, 'company_name') || loc(customer.company_name)) : '—';
  const pName = (p) => pick(p, 'name') || loc(p.name);
  const pDesc = (p) => pick(p, 'description') || loc(p.description);

  const box = { border: '1px solid #d8d4cc' };

  return (
    <div dir={dir} className="qdoc" style={{
      fontFamily: isAr ? "'IBM Plex Sans Arabic','Tajawal','Segoe UI',sans-serif" : "'Inter','Segoe UI',sans-serif",
      color: '#1a1a18', background: '#fff', maxWidth: 794, margin: '0 auto', padding: '32px 36px 64px', fontSize: 12.5, lineHeight: 1.5,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Print pagination strategy — thead/tfoot repetition, NOT
          position:fixed. The header, body and footer live inside one
          single-column layout table (.qdoc-layout below): browsers
          natively repeat <thead> at the top and <tfoot> at the bottom
          of EVERY printed page fragment, reserving exactly the right
          amount of space automatically. The previous approach
          (position:fixed bars + hardcoded body padding to clear them)
          required guessing the bars' rendered heights in px — any drift
          between the guess and reality produced either a huge blank gap
          under the header or content underlapping the footer, which is
          exactly the bug it caused. With thead/tfoot the browser
          measures the real height itself; there is nothing to guess and
          nothing to drift.

          On screen the layout table renders identically to plain block
          flow (header top, body middle, footer bottom, single column) —
          so preview and print are the same markup, same geometry.

          The watermark IS print-fixed: position:fixed under print makes
          Chrome repeat it centered on every printed page; on a
          single-page document (the common case) that's the same visual
          center the screen preview shows, and on multi-page documents
          every page gets the watermark, per spec.

          print-color-adjust keeps the green table headers / grand-total
          bar filled in a manual Ctrl+P too, where browsers otherwise
          strip background colors by default. */}
      <style>{`
        .qdoc-layout { width: 100%; border-collapse: collapse; }
        .qdoc-layout > thead > tr > td, .qdoc-layout > tbody > tr > td, .qdoc-layout > tfoot > tr > td { padding: 0; vertical-align: top; }
        @media print {
          .qdoc { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .qdoc-watermark { position: fixed !important; }
          .qdoc-body table tr { break-inside: avoid; page-break-inside: avoid; }
          /* Footer pinned NEAR the bottom of the A4 page (not floating
             mid-page after the signatures, and not flush against the
             true physical edge either): force the layout table to be at
             least almost one full page-content tall (297mm minus .qdoc's
             own 32px top + 64px bottom padding, minus a further 15mm so
             the footer sits with genuine breathing room above the page's
             true bottom edge instead of touching it), and give the
             header/footer rows a token 1px height — the browser then
             hands ALL the leftover height to the unconstrained body row,
             so any blank space lands between the signatures and the
             footer instead of below the footer. vertical-align:top above
             keeps the body content at the top of that stretched row
             (cells otherwise default to middle, which would have floated
             the whole body to the page's vertical center). Documents
             longer than one page are unaffected: table height is a
             minimum, and pagination proceeds normally. */
          .qdoc-layout { min-height: calc(297mm - 96px - 15mm); }
          .qdoc-layout > thead > tr, .qdoc-layout > tfoot > tr { height: 1px; }
        }
      `}</style>

      {/* Watermark — centered, low-opacity, behind all content. Purely
          decorative: not present in the accessibility tree. */}
      <img src="/logo.png" alt="" aria-hidden="true" className="qdoc-watermark" style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 380, height: 'auto', opacity: 0.06, zIndex: 0, pointerEvents: 'none',
      }} />

      {/* Header — a true 3-column layout. The 3rd column here is just a
          reserved empty spacer matching the QR card's width, so the
          center title/meta column never stretches underneath it; the
          actual QR image is rendered as a separate, absolutely-positioned
          sibling below (anchored to this same qdoc box, top-right) so it
          can be page-1-only, landing exactly in this reserved slot and
          reading as one continuous header row.
          minmax(0, 1fr) — NOT bare 1fr — on the first column: a bare
          `1fr` track computes a minimum width of `auto`, which lets long
          content (the company name / contact line) grow past its own
          column and visually overlap the title column next to it
          instead of wrapping. minmax(0, 1fr) caps that minimum at 0,
          which is what actually forces overflowing text to wrap within
          its own column — this is the fix for the exact "company name
          runs into QUOTATION" / "VAT No. collides with Valid Until" bug. */}
      {/* direction:'ltr' on the header/QR containers freezes their
          column/flex order regardless of document language — otherwise
          the browser mirrors grid columns and flex justify-content for
          RTL, which moved the QR to the wrong side and off its reserved
          slot in Arabic. Each inner block re-applies dir={dir} so its
          own TEXT still reads correctly; only the outer POSITIONS stay
          identical between languages, per spec. */}
      {/* QR code — page-1-only by construction: position:absolute against
          the outer .qdoc box (the nearest position:relative ancestor). It
          sits OUTSIDE the layout table below (as a sibling, before it in
          source) because a table may only contain thead/tbody/tfoot
          children — and being out-of-flow, its rendered position doesn't
          depend on source order anyway.
          English: top-right, filling the header grid's reserved 138px
          third column (top 32 = .qdoc's own padding-top).
          Arabic: top-LEFT, filling the header grid's reserved first
          column — mirroring the English placement, per the approved
          reference image: QR far left, title/details beside it, company
          info + logo on the right. */}
      {qrDataUrl && (
        <div className="qdoc-qr" style={isAr
          ? { position: 'absolute', top: 32, left: 36, direction: 'ltr', zIndex: 2 }
          : { position: 'absolute', top: 32, insetInlineEnd: 36, direction: 'ltr', zIndex: 2 }}>
          <div style={{
            textAlign: 'center', background: '#fff', padding: 8, borderRadius: 8,
            border: '1px solid #dcd9d2', boxShadow: '0 1px 4px rgba(26,26,24,0.08)',
          }}>
            <img src={qrDataUrl} alt="" width={120} height={120} style={{ display: 'block', borderRadius: 4 }} />
            <div style={{ fontSize: 8, color: '#8c8a80', marginTop: 4, whiteSpace: 'nowrap' }}>{t.scanToVerify}</div>
          </div>
        </div>
      )}

      {/* Single-column layout table: thead repeats on every printed page,
          tfoot renders at (and repeats at) the bottom of every printed
          page — the browser reserves their real measured height on each
          page automatically. On screen this renders identically to plain
          stacked divs. See the print-strategy comment above. */}
      <table className="qdoc-layout">
      <thead><tr><td>
      {/* Header — direction:'ltr' frozen on the grid so column POSITIONS
          never mirror; each inner block re-applies its own dir for text.
          English: [logo+company | QUOTATION+details | 138px QR slot].
          Arabic — a true RTL mirror of that, matching the approved
          reference image exactly: [138px QR slot | عرض سعر+details |
          company info+logo], i.e. the logo sits on the far RIGHT with
          the right-aligned company info beside it, the title/details in
          the middle, and the QR card on the far LEFT.
          The invisible spacers only reserve the QR card's real height
          (~150px) in the grid so the body always starts below it — the
          QR image itself is the absolutely-positioned sibling above
          (page-1-only); spacers repeating on every printed page render
          nothing visible. */}
      <div className="qdoc-header" style={{
        position: 'relative', zIndex: 1, display: 'grid', direction: 'ltr',
        gridTemplateColumns: isAr
          ? (qrDataUrl ? '138px auto minmax(0, 1fr)' : 'auto minmax(0, 1fr)')
          : (qrDataUrl ? 'minmax(0, 1fr) auto 138px' : 'minmax(0, 1fr) auto'),
        alignItems: 'flex-start', gap: 16, borderBottom: '3px solid #6B7A4F', paddingBottom: 14,
      }}>
        {isAr && qrDataUrl && <div aria-hidden="true" style={{ minHeight: 150 }} />}
        {isAr && (
          <div dir="rtl" style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{t.quotation}</div>
            <table style={{ fontSize: 12, marginTop: 6, marginLeft: 'auto' }}>
              <tbody>
                <tr><td style={{ color: '#6b6b63', paddingInlineEnd: 10 }}>{t.number}</td><td style={{ fontWeight: 600 }} dir="ltr">{doc.quote_number}</td></tr>
                <tr><td style={{ color: '#6b6b63', paddingInlineEnd: 10 }}>{t.date}</td><td dir="ltr">{dateStr(doc.quote_date)}</td></tr>
                <tr><td style={{ color: '#6b6b63', paddingInlineEnd: 10 }}>{t.validUntil}</td><td dir="ltr">{dateStr(doc.valid_until)}</td></tr>
              </tbody>
            </table>
          </div>
        )}
        {isAr ? (
          /* Company info (right-aligned, RTL) with the logo on the far
             right — justifyContent:'flex-end' pins the pair against the
             page's right edge; alignItems:'center' vertically balances
             the logo against the multi-line info block. Phone + س.ت stay
             on ONE line, الرقم الضريبي on its own line — dir=rtl reads
             naturally while digit runs stay left-to-right under the bidi
             algorithm, so numbers remain readable. */
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0, justifyContent: 'flex-end', direction: 'ltr' }}>
            <div dir="rtl" style={{ minWidth: 0, textAlign: 'right' }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: '#46512F', lineHeight: 1.15 }}>
                {splitCompanyName(eName).map((line, i) => line && <div key={i}>{line}</div>)}
              </div>
              <div style={{ color: '#6b6b63', marginTop: 3 }}>{eAddr}</div>
              <div style={{ color: '#6b6b63', whiteSpace: 'nowrap' }}>
                {entity?.phone && <span>☎ {entity.phone}</span>}
                {entity?.cr_number && <span> · {t.cr}: {entity.cr_number}</span>}
              </div>
              {entity?.vat_number && (
                <div style={{ color: '#6b6b63', whiteSpace: 'nowrap' }}>{t.vatNo}: {entity.vat_number}</div>
              )}
            </div>
            <img src="/logo.png" alt="" style={{ height: 62, width: 'auto', flexShrink: 0 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0, direction: 'ltr' }}>
            <img src="/logo.png" alt="" style={{ height: 62, width: 'auto', flexShrink: 0 }} />
            <div dir={dir} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: '#46512F', lineHeight: 1.15 }}>
                {splitCompanyName(eName).map((line, i) => line && <div key={i}>{line}</div>)}
              </div>
              <div style={{ color: '#6b6b63', marginTop: 3 }}>{eAddr}</div>
              {/* Phone + CR on ONE line, VAT No. on its own line below —
                  nowrap so neither can ever wrap mid-line. */}
              <div style={{ color: '#6b6b63', whiteSpace: 'nowrap' }} dir="ltr">
                {entity?.phone && <span>☎ {entity.phone}</span>}
                {entity?.cr_number && <span> · {t.cr}: {entity.cr_number}</span>}
              </div>
              {entity?.vat_number && (
                <div style={{ color: '#6b6b63', whiteSpace: 'nowrap' }} dir="ltr">{t.vatNo}: {entity.vat_number}</div>
              )}
            </div>
          </div>
        )}
        {!isAr && (
          <div dir={dir} style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>{t.quotation}</div>
            <table style={{ fontSize: 12, marginTop: 6, marginLeft: 'auto' }}>
              <tbody>
                <tr><td style={{ color: '#6b6b63', paddingInlineEnd: 10 }}>{t.number}</td><td style={{ fontWeight: 600 }} dir="ltr">{doc.quote_number}</td></tr>
                <tr><td style={{ color: '#6b6b63', paddingInlineEnd: 10 }}>{t.date}</td><td dir="ltr">{dateStr(doc.quote_date)}</td></tr>
                <tr><td style={{ color: '#6b6b63', paddingInlineEnd: 10 }}>{t.validUntil}</td><td dir="ltr">{dateStr(doc.valid_until)}</td></tr>
              </tbody>
            </table>
          </div>
        )}
        {!isAr && qrDataUrl && <div aria-hidden="true" style={{ minHeight: 150 }} />}
      </div>
      </td></tr></thead>

      <tbody><tr><td>
      <div className="qdoc-body" style={{ position: 'relative', zIndex: 1 }}>
      {/* Customer */}
      <div style={{ ...box, borderRadius: 8, padding: '10px 14px', marginTop: 14, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div><span style={{ color: '#6b6b63' }}>{t.customer}: </span><b>{cName}</b></div>
        {customer?.contact_person && <div><span style={{ color: '#6b6b63' }}>{t.contact}: </span>{customer.contact_person}</div>}
        {customer?.phone && <div dir="ltr"><span style={{ color: '#6b6b63' }}>{t.phone}: </span>{customer.phone}</div>}
      </div>

      {/* Items */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14 }}>
        <thead>
          <tr style={{ background: '#46512F', color: '#fff', fontSize: 11 }}>
            <th style={{ padding: '7px 8px', textAlign: 'start', width: 26 }}>{t.item}</th>
            <th style={{ padding: '7px 8px', textAlign: 'start' }}>{t.description}</th>
            <th style={{ padding: '7px 8px', width: 52 }}>{t.qty}</th>
            <th style={{ padding: '7px 8px', width: 56 }}>{t.unit}</th>
            <th style={{ padding: '7px 8px', width: 84, textAlign: 'end' }}>{t.unitPrice}</th>
            <th style={{ padding: '7px 8px', width: 40 }}>{t.taxable}</th>
            <th style={{ padding: '7px 8px', width: 96, textAlign: 'end' }}>{t.amount}</th>
          </tr>
        </thead>
        <tbody>
          {(products || []).map((p, i) => (
            <tr key={p.id || i} style={{ borderBottom: '1px solid #e5e2dd', verticalAlign: 'top', breakInside: 'avoid' }}>
              <td style={{ padding: '8px', color: '#6b6b63' }}>{i + 1}</td>
              <td style={{ padding: '8px' }}>
                <div style={{ fontWeight: 600 }}>{pName(p)}</div>
                {pDesc(p) && <div style={{ color: '#55534c', whiteSpace: 'pre-wrap', fontSize: 11.5 }}>{pDesc(p)}</div>}
              </td>
              <td style={{ padding: '8px', textAlign: 'center' }} dir="ltr">{Number(p.qty)}</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>{p.unit}</td>
              <td style={{ padding: '8px', textAlign: 'end' }} dir="ltr">{money(p.unit_price)}</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>{p.taxable !== false ? t.yes : t.no}</td>
              <td style={{ padding: '8px', textAlign: 'end', fontWeight: 600 }} dir="ltr">{money(p.line_total != null ? p.line_total : Number(p.qty) * Number(p.unit_price))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals + delivery/notes side by side (last page only — this
          simply falls wherever the item table ends, which is always
          the final page since nothing follows it but this section) */}
      <div style={{ display: 'flex', gap: 16, marginTop: 14, alignItems: 'flex-start', breakInside: 'avoid' }}>
        <div style={{ flex: 1, fontSize: 11.5, color: '#55534c' }}>
          {doc.delivery_terms && <div><b>{t.deliveryTerms}:</b> {locProse(doc.delivery_terms, isAr)}</div>}
          {doc.customer_notes && <div style={{ marginTop: 6 }}><b>{t.notes}:</b> {locProse(doc.customer_notes, isAr)}</div>}
        </div>
        <table style={{ width: 280, borderCollapse: 'collapse', fontSize: 12 }}>
          <tbody>
            <Trow label={t.subtotal} value={money(doc.subtotal)} />
            {Number(doc.discount_amount) > 0 && <Trow label={t.discount + (doc.discount_type === 'pct' ? ` (${Number(doc.discount_value)}%)` : '')} value={'−' + money(doc.discount_amount)} />}
            <Trow label={t.net} value={money(doc.net_total)} />
            <Trow label={`${t.vat} ${Number(doc.vat_rate)}%`} value={money(doc.vat_amount)} />
            <tr>
              <td style={{ padding: '8px 10px', background: '#46512F', color: '#fff', fontWeight: 700 }}>{t.grandTotal}</td>
              <td style={{ padding: '8px 10px', background: '#46512F', color: '#fff', fontWeight: 700, textAlign: 'end' }} dir="ltr">{money(doc.grand_total)} {t.currency}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Payment Terms — a dynamic free-text section; entirely absent
          (no heading either) when the field is empty. */}
      {doc.payment_terms && String(doc.payment_terms).trim() && (
        <div style={{ marginTop: 16, fontSize: 11, color: '#55534c', breakInside: 'avoid' }}>
          <div style={{ fontWeight: 700, color: '#1a1a18', marginBottom: 3 }}>{t.paymentTerms}</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{locProse(doc.payment_terms, isAr)}</div>
        </div>
      )}

      {/* Bank Details */}
      <div style={{ ...box, borderRadius: 8, padding: '12px 14px', marginTop: 28, fontSize: 11.5, breakInside: 'avoid' }}>
        <div style={{ fontWeight: 700, color: '#1a1a18', marginBottom: 8 }}>{t.bankDetails}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 28px' }} dir="ltr">
          <div><span style={{ color: '#6b6b63' }}>{t.bank}: </span><b>{BANK_DETAILS.bank}</b></div>
          <div><span style={{ color: '#6b6b63' }}>{t.accountNumber}: </span><b>{BANK_DETAILS.accountNumber}</b></div>
          <div><span style={{ color: '#6b6b63' }}>{t.iban}: </span><b>{BANK_DETAILS.iban}</b></div>
          <div><span style={{ color: '#6b6b63' }}>{t.accountName}: </span><b>{BANK_DETAILS.accountName}</b></div>
        </div>
      </div>

      {/* Terms & Conditions */}
      {(doc.terms_body_override || terms) && (
        <div style={{ marginTop: 28, fontSize: 11, color: '#55534c', breakInside: 'avoid' }}>
          <div style={{ fontWeight: 700, color: '#1a1a18', marginBottom: 6 }}>{t.terms}</div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{locProse(doc.terms_body_override || terms.body, isAr)}</div>
        </div>
      )}

        {/* Signatures */}
        <div style={{ display: 'flex', gap: 20, marginTop: 64, breakInside: 'avoid' }}>
          {[t.preparedBy, t.approvedBy, t.customerSign].map(s => (
            <div key={s} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #8c8a80', paddingTop: 8, fontSize: 11, color: '#6b6b63' }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      </td></tr></tbody>

      {/* Footer — lives in the layout table's tfoot, so the browser
          renders (and repeats) it at the bottom of every printed page
          with its real measured height; on screen it renders in normal
          flow at the end of the document, same as before.
          whiteSpace:nowrap on each line keeps company/CR/VAT (line 1)
          and phone/email/website (line 2) each on ONE single line —
          the font is small (9.5px) and both lines fit A4's content
          width; nowrap guarantees no mid-line wrapping either way. */}
      <tfoot><tr><td>
      <div className="qdoc-footer" style={{
        marginTop: 24, paddingTop: 8, borderTop: '1px solid #d8d4cc',
        fontSize: 9.5, color: '#8c8a80', textAlign: 'center', position: 'relative', zIndex: 1,
      }}>
        <div style={{ whiteSpace: 'nowrap' }}>
          {eName}
          {eAddr && <span> · {eAddr}</span>}
          {entity?.cr_number && <span> · {t.cr}: {entity.cr_number}</span>}
          {entity?.vat_number && <span> · {t.vatNo}: {entity.vat_number}</span>}
        </div>
        <div dir="ltr" style={{ whiteSpace: 'nowrap' }}>
          {entity?.phone && <span>☎ {entity.phone}</span>}
          {entity?.email && <span> · ✉ {entity.email}</span>}
          {entity?.website && <span> · {t.website}: {entity.website}</span>}
        </div>
      </div>
      </td></tr></tfoot>
      </table>
    </div>
  );
}

function Trow({ label, value }) {
  return (
    <tr style={{ borderBottom: '1px solid #e5e2dd' }}>
      <td style={{ padding: '6px 10px', color: '#6b6b63' }}>{label}</td>
      <td style={{ padding: '6px 10px', textAlign: 'end', fontWeight: 600 }} dir="ltr">{value}</td>
    </tr>
  );
}
