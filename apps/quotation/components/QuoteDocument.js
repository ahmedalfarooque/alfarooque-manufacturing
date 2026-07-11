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
      {/* Print-only repeating header/footer/watermark: Chrome repeats
          position:fixed elements on every printed page, which is what
          makes the header/logo/quote#/customer, watermark, and footer
          appear on page 2, 3, 4… without any per-page JS. The .qdoc-body
          gets matching top/bottom padding in print so its content never
          renders underneath the fixed bars. Screen view is unaffected
          (rules are scoped to @media print). */}
      <style>{`
        @media print {
          .qdoc-header, .qdoc-footer { position: fixed; left: 0; right: 0; background: #fff; z-index: 2; }
          .qdoc-header { top: 0; padding-top: 8mm; }
          .qdoc-footer { bottom: 0; padding-bottom: 6mm; }
          .qdoc-body { padding-top: 104px; padding-bottom: 64px; }
          .qdoc-watermark { position: fixed !important; }
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
      <div className="qdoc-header" style={{
        position: 'relative', zIndex: 1, display: 'grid', direction: 'ltr',
        gridTemplateColumns: qrDataUrl ? 'minmax(0, 1fr) auto 138px' : 'minmax(0, 1fr) auto',
        alignItems: 'flex-start', gap: 16, borderBottom: '3px solid #6B7A4F', paddingBottom: 14,
      }}>
        <div dir={dir} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
          <img src="/logo.png" alt="" style={{ height: 56, width: 'auto', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: '#46512F', lineHeight: 1.15 }}>
              {splitCompanyName(eName).map((line, i) => line && <div key={i}>{line}</div>)}
            </div>
            <div style={{ color: '#6b6b63', marginTop: 3 }}>{eAddr}</div>
            <div style={{ color: '#6b6b63' }} dir="ltr">
              {entity?.phone && <span>☎ {entity.phone} </span>}
              {entity?.cr_number && <span> · {t.cr}: {entity.cr_number}</span>}
              {entity?.vat_number && <span> · {t.vatNo}: {entity.vat_number}</span>}
            </div>
          </div>
        </div>
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
        {/* Invisible spacer, NOT the QR image itself (see below) — its
            only job is to make the header's grid row auto-size tall
            enough to clear the QR card's real height (padding + 120px
            image + caption ≈ 150px), so .qdoc-body naturally starts
            below the QR with no overlap and no hard-coded margin on
            .qdoc-body to maintain. Safe to have this repeat on every
            printed page (unlike the actual QR image) since it renders
            nothing visible. */}
        {qrDataUrl && <div aria-hidden="true" style={{ minHeight: 150 }} />}
      </div>

      {/* QR code — first-page-only by construction: position:absolute
          against the outer .qdoc box (the nearest position:relative
          ancestor) anchored to its top-right padding edge — the exact
          same starting point the header itself renders from — instead
          of the previous "pull it up by a hard-coded pixel guess"
          approach, so this stays correctly aligned no matter how tall
          the header's left column becomes (2-line company name, bigger
          logo, or any future header content change) without needing a
          matching magic-number update every time. Being absolutely
          positioned takes it out of flow entirely, so it never affects
          where .qdoc-body starts, on screen or in print; and because
          .qdoc (its positioned ancestor) is one continuous flowed box
          — not per-page — top:0 here lands on page 1 only, same as
          before. */}
      {qrDataUrl && (
        <div style={{ position: 'absolute', top: 32, insetInlineEnd: 36, direction: 'ltr', zIndex: 2 }}>
          <div style={{
            textAlign: 'center', background: '#fff', padding: 8, borderRadius: 8,
            border: '1px solid #dcd9d2', boxShadow: '0 1px 4px rgba(26,26,24,0.08)',
          }}>
            <img src={qrDataUrl} alt="" width={120} height={120} style={{ display: 'block', borderRadius: 4 }} />
            <div style={{ fontSize: 8, color: '#8c8a80', marginTop: 4, whiteSpace: 'nowrap' }}>{t.scanToVerify}</div>
          </div>
        </div>
      )}

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
      <div style={{ ...box, borderRadius: 8, padding: '10px 14px', marginTop: 16, fontSize: 11.5, breakInside: 'avoid' }}>
        <div style={{ fontWeight: 700, color: '#1a1a18', marginBottom: 6 }}>{t.bankDetails}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 28px' }} dir="ltr">
          <div><span style={{ color: '#6b6b63' }}>{t.bank}: </span><b>{BANK_DETAILS.bank}</b></div>
          <div><span style={{ color: '#6b6b63' }}>{t.accountNumber}: </span><b>{BANK_DETAILS.accountNumber}</b></div>
          <div><span style={{ color: '#6b6b63' }}>{t.iban}: </span><b>{BANK_DETAILS.iban}</b></div>
          <div><span style={{ color: '#6b6b63' }}>{t.accountName}: </span><b>{BANK_DETAILS.accountName}</b></div>
        </div>
      </div>

      {/* Terms & Conditions */}
      {(doc.terms_body_override || terms) && (
        <div style={{ marginTop: 16, fontSize: 11, color: '#55534c', breakInside: 'avoid' }}>
          <div style={{ fontWeight: 700, color: '#1a1a18', marginBottom: 3 }}>{t.terms}</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{locProse(doc.terms_body_override || terms.body, isAr)}</div>
        </div>
      )}

        {/* Signatures */}
        <div style={{ display: 'flex', gap: 20, marginTop: 34, breakInside: 'avoid' }}>
          {[t.preparedBy, t.approvedBy, t.customerSign].map(s => (
            <div key={s} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #8c8a80', paddingTop: 5, fontSize: 11, color: '#6b6b63' }}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer — repeated on every printed page via the .qdoc-footer
          fixed-position rule the print page supplies; renders in normal
          flow here too so it's visible in a plain (non-print) view. */}
      <div className="qdoc-footer" style={{
        marginTop: 24, paddingTop: 8, borderTop: '1px solid #d8d4cc',
        fontSize: 9.5, color: '#8c8a80', textAlign: 'center', position: 'relative', zIndex: 1,
      }}>
        <div>
          {eName}
          {eAddr && <span> · {eAddr}</span>}
          {entity?.cr_number && <span> · {t.cr}: {entity.cr_number}</span>}
          {entity?.vat_number && <span> · {t.vatNo}: {entity.vat_number}</span>}
        </div>
        <div dir="ltr">
          {entity?.phone && <span>☎ {entity.phone}</span>}
          {entity?.email && <span> · ✉ {entity.email}</span>}
          {entity?.website && <span> · {t.website}: {entity.website}</span>}
        </div>
      </div>
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
