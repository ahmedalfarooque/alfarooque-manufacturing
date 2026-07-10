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
  },
};

import { translate, hasArabic } from '@/lib/translate';

function money(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function dateStr(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB'); } catch (_) { return String(d); }
}

export default function QuoteDocument({ doc, products, entity, customer, terms, lang }) {
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
    <div dir={dir} style={{
      fontFamily: isAr ? "'IBM Plex Sans Arabic','Tajawal','Segoe UI',sans-serif" : "'Inter','Segoe UI',sans-serif",
      color: '#1a1a18', background: '#fff', maxWidth: 794, margin: '0 auto', padding: '32px 36px', fontSize: 12.5, lineHeight: 1.5,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderBottom: '3px solid #6B7A4F', paddingBottom: 14 }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#46512F' }}>{eName}</div>
          <div style={{ color: '#6b6b63' }}>{eAddr}</div>
          <div style={{ color: '#6b6b63' }} dir="ltr">
            {entity?.phone && <span>☎ {entity.phone} </span>}
            {entity?.cr_number && <span> · {t.cr}: {entity.cr_number}</span>}
            {entity?.vat_number && <span> · {t.vatNo}: {entity.vat_number}</span>}
          </div>
        </div>
        <div style={{ textAlign: isAr ? 'left' : 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>{t.quotation}</div>
          <table style={{ fontSize: 12, marginTop: 6, [isAr ? 'marginRight' : 'marginLeft']: 'auto' }}>
            <tbody>
              <tr><td style={{ color: '#6b6b63', paddingInlineEnd: 10 }}>{t.number}</td><td style={{ fontWeight: 600 }} dir="ltr">{doc.quote_number}</td></tr>
              <tr><td style={{ color: '#6b6b63', paddingInlineEnd: 10 }}>{t.date}</td><td dir="ltr">{dateStr(doc.quote_date)}</td></tr>
              <tr><td style={{ color: '#6b6b63', paddingInlineEnd: 10 }}>{t.validUntil}</td><td dir="ltr">{dateStr(doc.valid_until)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

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

      {/* Totals + notes side by side */}
      <div style={{ display: 'flex', gap: 16, marginTop: 14, alignItems: 'flex-start', breakInside: 'avoid' }}>
        <div style={{ flex: 1, fontSize: 11.5, color: '#55534c' }}>
          {doc.payment_terms && <div><b>{t.paymentTerms}:</b> {loc(doc.payment_terms)}</div>}
          {doc.delivery_terms && <div><b>{t.deliveryTerms}:</b> {loc(doc.delivery_terms)}</div>}
          {doc.customer_notes && <div style={{ marginTop: 6 }}><b>{t.notes}:</b> {loc(doc.customer_notes)}</div>}
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

      {/* Terms */}
      {(doc.terms_body_override || terms) && (
        <div style={{ marginTop: 16, fontSize: 11, color: '#55534c', breakInside: 'avoid' }}>
          <div style={{ fontWeight: 700, color: '#1a1a18', marginBottom: 3 }}>{t.terms}</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{loc(doc.terms_body_override || terms.body)}</div>
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
