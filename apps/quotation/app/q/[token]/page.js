/* Public read-only quotation view (no auth) reached via the unguessable
   public_token link / QR. Server component: fetches directly with the
   service client and projects ONLY customer-safe fields — no costs, no
   internal notes, no margins. */

import QuoteDocument, { money, dateStr } from '@/components/QuoteDocument';
import { buildQuoteQrText, buildQuoteQrDataUrl } from '@/lib/qr';

const { getDb } = require('@/lib/db');

export const dynamic = 'force-dynamic';

export default async function PublicQuotationPage({ params }) {
  const sb = getDb();

  const { data: doc } = await sb.from('qt_quotations')
    .select('id, quote_number, status, quote_date, valid_until, output_lang, payment_terms, delivery_terms, customer_notes, terms_template_id, terms_body_override, discount_type, discount_value, subtotal, discount_amount, net_total, vat_rate, vat_amount, grand_total, entity:qt_entities(name_en, name_ar, address_en, address_ar, phone, email, website, cr_number, vat_number), customer:customers(company_name, company_name_en, company_name_ar, contact_person, phone:mobile_number)')
    .eq('public_token', params.token)
    .is('deleted_at', null)
    .maybeSingle();

  if (!doc || ['draft', 'cancelled'].includes(doc.status)) {
    return (
      <div style={{ fontFamily: 'sans-serif', padding: 60, textAlign: 'center', color: '#666' }}>
        <div style={{ fontSize: 40 }}>🔍</div>
        <p>This quotation link is not available.</p>
      </div>
    );
  }

  const { data: products } = await sb.from('qt_quotation_products')
    .select('id, sort, name, description, unit, qty, unit_price, taxable, line_total')
    .eq('quotation_id', doc.id).order('sort');

  let terms = null;
  if (doc.terms_template_id && !doc.terms_body_override) {
    const { data: tt } = await sb.from('qt_terms_templates')
      .select('body').eq('id', doc.terms_template_id).maybeSingle();
    terms = tt;
  }

  const lang = doc.output_lang || 'en';
  const isAr = lang === 'ar';
  const pick = (row, base) => row && (isAr ? (row[base + '_ar'] || row[base + '_en']) : (row[base + '_en'] || row[base + '_ar']));
  const qrText = buildQuoteQrText(lang, {
    entityName: isAr ? (doc.entity?.name_ar || doc.entity?.name_en) : (doc.entity?.name_en || doc.entity?.name_ar),
    customerName: doc.customer ? (pick(doc.customer, 'company_name') || doc.customer.company_name) : '',
    quoteNumber: doc.quote_number,
    quoteDate: dateStr(doc.quote_date),
    validUntil: dateStr(doc.valid_until),
    grandTotal: money(doc.grand_total),
    currency: isAr ? 'ر.س' : 'SAR',
    phone: doc.entity?.phone, email: doc.entity?.email, website: doc.entity?.website,
  });
  const qrDataUrl = await buildQuoteQrDataUrl(qrText).catch(() => null);

  return (
    <div className="qv-stage" style={{ background: '#e9e6e0', minHeight: '100vh', padding: '24px 0' }}>
      {/* Server component, so no JS-measured scale — instead a few fixed
          breakpoint scale steps keep the 794px document from ever forcing
          horizontal scroll on a phone. Desktop (>850px) is untouched:
          scale(1), identical to before. Any leftover vertical whitespace
          below the shrunk sheet on very small screens is a deliberate,
          acceptable trade-off for a static page — no overflow, no
          scrollbar, exact desktop appearance preserved above 850px. */}
      <style>{`
        /* Same clip as the authenticated print viewer: transform:scale()
           shrinks paint only, not the 794px layout box, so overflow:hidden
           on the wrap is what actually prevents horizontal page scroll on
           phones — and WebKit only honors that clip reliably once the
           wrap is promoted to its own compositing layer. translateZ(0)
           forces that layer without altering any visible layout. */
        .qv-wrap {
          display: flex; justify-content: center; overflow: hidden;
          width: 100%; max-width: 100vw;
          transform: translateZ(0); -webkit-transform: translateZ(0);
          -webkit-mask-image: -webkit-radial-gradient(white, black);
        }
        .qv-shell { width: 794px; flex: 0 0 auto; background: #fff; box-shadow: 0 8px 40px rgba(0,0,0,.18); border-radius: 4px; }
        @media (max-width: 850px) {
          .qv-shell { transform: scale(0.9); transform-origin: top center; margin-bottom: -10%; }
        }
        @media (max-width: 700px) {
          .qv-shell { transform: scale(0.72); transform-origin: top center; margin-bottom: -28%; }
        }
        @media (max-width: 480px) {
          .qv-shell { transform: scale(0.46); transform-origin: top center; margin-bottom: -54%; }
        }
        @media (max-width: 360px) {
          .qv-shell { transform: scale(0.4); transform-origin: top center; margin-bottom: -60%; }
        }
        @media (max-width: 768px) {
          .qv-stage { overflow-x: hidden; }
        }
      `}</style>
      <div className="qv-wrap">
        <div className="qv-shell">
          <QuoteDocument
            doc={doc}
            products={products || []}
            entity={doc.entity}
            customer={doc.customer}
            terms={terms}
            lang={lang}
            qrDataUrl={qrDataUrl}
          />
        </div>
      </div>
      <div style={{ textAlign: 'center', padding: 16, fontFamily: 'sans-serif', fontSize: 12, color: '#8c8a80' }}>
        AL FAROOQUE — alfarooque.com
      </div>
    </div>
  );
}
