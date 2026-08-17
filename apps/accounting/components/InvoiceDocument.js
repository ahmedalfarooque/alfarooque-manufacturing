/* Pure presentational SmartLife invoice document (A4-friendly), used by
   the Accounting print view. Deliberately mirrors
   apps/quotation/components/QuoteDocument.js byte-for-byte on every
   shared visual decision — same fonts, same #006B7A brand color, same
   header grid, same thead/tfoot pagination technique, same fixed footer
   pattern, same watermark — so an invoice reads as the SAME AL FAROOQUE
   document system as a quotation, not a second design. Only the sections
   that do not apply to a settled SmartLife invoice (bank details, terms,
   signature — all quotation-specific, forward-looking content) are
   omitted; everything else duplicates the quotation template's structure
   with invoice content in place of quotation content, per spec ("only
   the CONTENT changes"). QuoteDocument.js itself is not imported from or
   modified by this file — zero risk to the approved quotation design. */

import ZatcaQr from '@/components/ZatcaQr';
import { INVOICE_COMPANY as ENTITY } from '@/lib/invoiceCompany';

const L = {
  en: {
    salesInvoice: 'SALES INVOICE', purchaseInvoice: 'PURCHASE INVOICE', sourceNote: 'SmartLife source · read only',
    invoice: 'Invoice No.', date: 'Date', dueDate: 'Due Date',
    customer: 'Customer', supplier: 'Supplier', item: '#', description: 'DESCRIPTION', qty: 'QTY',
    unitPrice: 'UNIT PRICE', discount: 'DISCOUNT', taxPct: 'TAX %', amount: 'AMOUNT (SAR)',
    subtotal: 'SUBTOTAL', totalDiscount: 'Total Discount', net: 'NET TOTAL',
    vat: 'VAT', shipping: 'Shipping', grandTotal: 'GRAND TOTAL', currency: 'SAR',
    paid: 'Paid', balance: 'Balance', paymentStatus: 'Payment Status', saleStatus: 'Sale Status', purchaseStatus: 'Purchase Status',
    cr: 'CR', vatNo: 'VAT No.', page: 'Page', of: 'of', website: 'Web',
    smartLifeId: 'SmartLife ID',
  },
  ar: {
    salesInvoice: 'فاتورة مبيعات', purchaseInvoice: 'فاتورة مشتريات', sourceNote: 'مصدر البيانات: SmartLife · قراءة فقط',
    invoice: 'رقم الفاتورة', date: 'التاريخ', dueDate: 'تاريخ الاستحقاق',
    customer: 'العميل', supplier: 'المورد', item: '#', description: 'الوصف', qty: 'الكمية',
    unitPrice: 'سعر الوحدة', discount: 'الخصم', taxPct: 'الضريبة %', amount: 'المبلغ (ر.س)',
    subtotal: 'المجموع', totalDiscount: 'إجمالي الخصم', net: 'الصافي',
    vat: 'ضريبة القيمة المضافة', shipping: 'الشحن', grandTotal: 'الإجمالي النهائي', currency: 'ر.س',
    paid: 'المدفوع', balance: 'المتبقي', paymentStatus: 'حالة الدفع', saleStatus: 'حالة البيع', purchaseStatus: 'حالة الشراء',
    cr: 'س.ت', vatNo: 'الرقم الضريبي', page: 'صفحة', of: 'من', website: 'الموقع',
    smartLifeId: 'رقم SmartLife',
  },
};

export function money(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function dateStr(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-GB'); } catch (_) { return String(d); }
}

/* Same brand-line split rule as QuoteDocument.splitCompanyName — kept as
   an identical copy (not imported) so this file has zero dependency on
   the quotation component. */
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

function first(record, keys) {
  for (const key of keys) if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') return record[key];
  return null;
}

export default function InvoiceDocument({ invoice, lang, docType = 'sales' }) {
  const isAr = lang === 'ar';
  const isPurchase = docType === 'purchase';
  const t = L[isAr ? 'ar' : 'en'];
  const dir = isAr ? 'rtl' : 'ltr';
  const eName = isAr ? ENTITY.name_ar : ENTITY.name_en;
  const eAddr = isAr ? ENTITY.address_ar : ENTITY.address_en;
  const box = { border: '1px solid #d8d4cc' };

  const inv = invoice || {};
  const reference = first(inv, ['reference_no', 'invoice_number', 'number', 'reference', 'code']);
  const partyLabel = isPurchase ? t.supplier : t.customer;
  const partyName = isPurchase
    ? (first(inv, ['supplier', 'supplier_name', 'party_name']) || '—')
    : (first(inv, ['customer', 'customer_name', 'party_name']) || '—');
  const items = Array.isArray(inv.items) ? inv.items : [];
  const subtotal = Number(first(inv, ['total', 'subtotal', 'sub_total', 'net_amount']) || 0);
  const totalDiscount = Number(first(inv, ['total_discount']) || 0);
  const vatAmount = Number(first(inv, ['total_tax', 'vat_amount', 'tax_amount', 'vat', 'tax']) || 0);
  const shipping = Number(first(inv, ['total_shipping']) || 0);
  const grandTotal = Number(first(inv, ['grand_total', 'total_amount', 'amount']) || 0);
  const paid = Number(first(inv, ['paid_amount', 'amount_paid', 'paid', 'payment_total']) || 0);
  const balanceValue = first(inv, ['balance_amount', 'remaining_balance', 'balance', 'due_amount']);
  const balance = balanceValue == null ? Math.max(grandTotal - paid, 0) : Number(balanceValue || 0);
  const paymentStatus = first(inv, ['payment_status']) || (paid >= grandTotal && grandTotal ? 'Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid');
  const workflowStatus = first(inv, ['sale_status', 'purchase_status', 'status']);
  const smartLifeId = first(inv, ['id']);

  return (
    <div dir={dir} className="idoc" style={{
      fontFamily: isAr ? "var(--font-arabic), 'IBM Plex Sans Arabic','Tajawal','Segoe UI',sans-serif" : "'Inter','Segoe UI',sans-serif",
      color: '#1a1a18', background: '#fff', maxWidth: 794, margin: '0 auto', padding: '32px 36px 64px', fontSize: 12.5, lineHeight: 1.5,
      position: 'relative',
    }}>
      {/* Same pagination technique as QuoteDocument.js: thead/tfoot repeat
          natively on every printed page fragment; the footer is a
          position:fixed sibling repeated per-page independently of table
          fragmentation. See that file's comments for the full rationale
          — kept identical here on purpose. */}
      <style>{`
        .idoc-layout { width: 100%; border-collapse: collapse; }
        .idoc-layout > thead > tr > td, .idoc-layout > tbody > tr > td, .idoc-layout > tfoot > tr > td { padding: 0; vertical-align: top; }
        @media print {
          .idoc {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .idoc-layout > thead::before { content: ''; display: table-row; height: 32px; }
          .idoc-watermark { position: fixed !important; }
          .idoc-body table tr { break-inside: avoid; page-break-inside: avoid; }
          .idoc-footer-screen { display: none !important; }
          .idoc-footer-print {
            display: block !important;
            position: fixed !important;
            bottom: 0; left: 36px; right: 36px;
            background: #fff; z-index: 2;
          }
          /* Reserve only the fixed footer's measured footprint on every
             fragmented page. This repeating tfoot spacer replaces the old
             420px body padding, which made the unbreakable totals/QR block
             fail to fit after short item tables and jump to page 2. */
          .idoc-footer-space { height: 44px; }
        }
      `}</style>

      <img src="/logo.png" alt="" aria-hidden="true" className="idoc-watermark" style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 380, height: 'auto', opacity: 0.06, zIndex: 0, pointerEvents: 'none',
      }} />

      <div className="idoc-footer-print" style={{
        display: 'none', paddingTop: 8, borderTop: '1px solid #d8d4cc',
        fontSize: 9.5, color: '#8c8a80', textAlign: 'center', zIndex: 1,
      }}>
        <div style={{ whiteSpace: 'nowrap' }}>
          {eName}
          {eAddr && <span> · {eAddr}</span>}
          {ENTITY.cr_number && <span> · {t.cr}: {ENTITY.cr_number}</span>}
          {ENTITY.vat_number && <span> · {t.vatNo}: {ENTITY.vat_number}</span>}
        </div>
        <div dir="ltr" style={{ whiteSpace: 'nowrap' }}>
          {ENTITY.phone && <span>☎ {ENTITY.phone}</span>}
          {ENTITY.email && <span> · ✉ {ENTITY.email}</span>}
          {ENTITY.website && <span> · {t.website}: {ENTITY.website}</span>}
        </div>
      </div>

      <table className="idoc-layout">
      <thead><tr><td>
      <div className="idoc-header" style={{
        position: 'relative', zIndex: 1, display: 'grid', direction: 'ltr',
        gridTemplateColumns: isAr ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr) auto',
        alignItems: 'flex-start', gap: 16, borderBottom: '3px solid #006B7A', paddingBottom: 14,
      }}>
        {isAr && (
          <div dir="rtl" style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{isPurchase ? t.purchaseInvoice : t.salesInvoice}</div>
            <div style={{ fontSize: 10, color: '#8c8a80', marginTop: 2 }}>{t.sourceNote}</div>
            <table style={{ fontSize: 12, marginTop: 6, marginLeft: 'auto' }}>
              <tbody>
                <tr><td style={{ color: '#6b6b63', paddingInlineEnd: 10 }}>{t.invoice}</td><td style={{ fontWeight: 600 }} dir="ltr">{reference}</td></tr>
                <tr><td style={{ color: '#6b6b63', paddingInlineEnd: 10 }}>{t.date}</td><td dir="ltr">{dateStr(first(inv, ['date', 'invoice_date', 'created_at']))}</td></tr>
                {first(inv, ['due_date']) && <tr><td style={{ color: '#6b6b63', paddingInlineEnd: 10 }}>{t.dueDate}</td><td dir="ltr">{dateStr(first(inv, ['due_date']))}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        {isAr ? (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0, justifyContent: 'flex-end', direction: 'ltr' }}>
            <div dir="rtl" style={{ minWidth: 0, textAlign: 'right' }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: '#006B7A', lineHeight: 1.15 }}>
                {splitCompanyName(eName).map((line, i) => line && <div key={i}>{line}</div>)}
              </div>
              <div style={{ color: '#6b6b63', marginTop: 3 }}>{eAddr}</div>
              <div style={{ color: '#6b6b63', whiteSpace: 'nowrap' }}>
                {ENTITY.phone && <span>☎ {ENTITY.phone}</span>}
                {ENTITY.cr_number && <span> · {t.cr}: {ENTITY.cr_number}</span>}
              </div>
              {ENTITY.vat_number && <div style={{ color: '#6b6b63', whiteSpace: 'nowrap' }}>{t.vatNo}: {ENTITY.vat_number}</div>}
            </div>
            <img src="/logo.png" alt="" style={{ height: 62, width: 'auto', flexShrink: 0 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0, direction: 'ltr' }}>
            <img src="/logo.png" alt="" style={{ height: 62, width: 'auto', flexShrink: 0 }} />
            <div dir={dir} style={{ minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: '#006B7A', lineHeight: 1.15 }}>
                {splitCompanyName(eName).map((line, i) => line && <div key={i}>{line}</div>)}
              </div>
              <div style={{ color: '#6b6b63', marginTop: 3 }}>{eAddr}</div>
              <div style={{ color: '#6b6b63', whiteSpace: 'nowrap' }} dir="ltr">
                {ENTITY.phone && <span>☎ {ENTITY.phone}</span>}
                {ENTITY.cr_number && <span> · {t.cr}: {ENTITY.cr_number}</span>}
              </div>
              {ENTITY.vat_number && <div style={{ color: '#6b6b63', whiteSpace: 'nowrap' }} dir="ltr">{t.vatNo}: {ENTITY.vat_number}</div>}
            </div>
          </div>
        )}
        {!isAr && (
          <div dir={dir} style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 1 }}>{isPurchase ? t.purchaseInvoice : t.salesInvoice}</div>
            <div style={{ fontSize: 10, color: '#8c8a80', marginTop: 2 }}>{t.sourceNote}</div>
            <table style={{ fontSize: 12, marginTop: 6, marginLeft: 'auto' }}>
              <tbody>
                <tr><td style={{ color: '#6b6b63', paddingInlineEnd: 10 }}>{t.invoice}</td><td style={{ fontWeight: 600 }} dir="ltr">{reference}</td></tr>
                <tr><td style={{ color: '#6b6b63', paddingInlineEnd: 10 }}>{t.date}</td><td dir="ltr">{dateStr(first(inv, ['date', 'invoice_date', 'created_at']))}</td></tr>
                {first(inv, ['due_date']) && <tr><td style={{ color: '#6b6b63', paddingInlineEnd: 10 }}>{t.dueDate}</td><td dir="ltr">{dateStr(first(inv, ['due_date']))}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </td></tr></thead>

      <tbody><tr><td>
      <div className="idoc-body" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ ...box, borderRadius: 8, padding: '10px 14px', marginTop: 14, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <div><span style={{ color: '#6b6b63' }}>{partyLabel}: </span><b>{partyName}</b></div>
          <div><span style={{ color: '#6b6b63' }}>{t.smartLifeId}: </span>{smartLifeId}</div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14 }}>
          <thead>
            <tr style={{ background: '#006B7A', color: '#fff', fontSize: 11 }}>
              <th style={{ padding: '7px 8px', textAlign: 'start', width: 26 }}>{t.item}</th>
              <th style={{ padding: '7px 8px', textAlign: 'start' }}>{t.description}</th>
              <th style={{ padding: '7px 8px', width: 52 }}>{t.qty}</th>
              <th style={{ padding: '7px 8px', width: 84, textAlign: 'end' }}>{t.unitPrice}</th>
              <th style={{ padding: '7px 8px', width: 70, textAlign: 'end' }}>{t.discount}</th>
              <th style={{ padding: '7px 8px', width: 50 }}>{t.taxPct}</th>
              <th style={{ padding: '7px 8px', width: 96, textAlign: 'end' }}>{t.amount}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p, i) => (
              <tr key={p.product_id || i} style={{ borderBottom: '1px solid #e5e2dd', verticalAlign: 'top', breakInside: 'avoid' }}>
                <td style={{ padding: '8px', color: '#6b6b63' }}>{i + 1}</td>
                <td style={{ padding: '8px' }}>
                  <div style={{ fontWeight: 600 }}>{p.product_name || '—'}</div>
                  {p.product_code && <div style={{ color: '#55534c', fontSize: 11.5 }}>{p.product_code}</div>}
                </td>
                <td style={{ padding: '8px', textAlign: 'center' }} dir="ltr">{Number(p.unit_quantity ?? p.quantity ?? 0)}</td>
                <td style={{ padding: '8px', textAlign: 'end' }} dir="ltr">{money(p.unit_price)}</td>
                <td style={{ padding: '8px', textAlign: 'end' }} dir="ltr">{money(p.discount)}</td>
                <td style={{ padding: '8px', textAlign: 'center' }}>{p.tax != null ? `${p.tax}%` : '—'}</td>
                <td style={{ padding: '8px', textAlign: 'end', fontWeight: 600 }} dir="ltr">{money(p.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: 16, marginTop: 14, alignItems: 'flex-start', breakInside: 'avoid' }}>
          <div style={{ flex: 1, fontSize: 11.5, color: '#55534c', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {!isPurchase && <ZatcaQr invoiceId={smartLifeId} size={132} compact />}
            <div style={{ flex: 1 }}>
              {workflowStatus && <div><b>{isPurchase ? t.purchaseStatus : t.saleStatus}:</b> {workflowStatus}</div>}
              {paymentStatus && <div style={{ marginTop: 6 }}><b>{t.paymentStatus}:</b> {paymentStatus}</div>}
            </div>
          </div>
          <table style={{ width: 280, borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              <Trow label={t.subtotal} value={money(subtotal)} />
              {totalDiscount > 0 && <Trow label={t.totalDiscount} value={'−' + money(totalDiscount)} />}
              <Trow label={t.net} value={money(subtotal - totalDiscount)} />
              <Trow label={t.vat} value={money(vatAmount)} />
              {shipping > 0 && <Trow label={t.shipping} value={money(shipping)} />}
              <tr>
                <td style={{ padding: '8px 10px', background: '#006B7A', color: '#fff', fontWeight: 700 }}>{t.grandTotal}</td>
                <td style={{ padding: '8px 10px', background: '#006B7A', color: '#fff', fontWeight: 700, textAlign: 'end' }} dir="ltr">{money(grandTotal)} {t.currency}</td>
              </tr>
              <Trow label={t.paid} value={money(paid)} />
              <Trow label={t.balance} value={money(balance)} />
            </tbody>
          </table>
        </div>
      </div>
      </td></tr></tbody>
      <tfoot aria-hidden="true"><tr><td><div className="idoc-footer-space" /></td></tr></tfoot>
      </table>

      <div className="idoc-footer-screen" style={{
        marginTop: 24, paddingTop: 8, borderTop: '1px solid #d8d4cc',
        fontSize: 9.5, color: '#8c8a80', textAlign: 'center', position: 'relative', zIndex: 1,
      }}>
        <div style={{ whiteSpace: 'nowrap' }}>
          {eName}
          {eAddr && <span> · {eAddr}</span>}
          {ENTITY.cr_number && <span> · {t.cr}: {ENTITY.cr_number}</span>}
          {ENTITY.vat_number && <span> · {t.vatNo}: {ENTITY.vat_number}</span>}
        </div>
        <div dir="ltr" style={{ whiteSpace: 'nowrap' }}>
          {ENTITY.phone && <span>☎ {ENTITY.phone}</span>}
          {ENTITY.email && <span> · ✉ {ENTITY.email}</span>}
          {ENTITY.website && <span> · {t.website}: {ENTITY.website}</span>}
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
