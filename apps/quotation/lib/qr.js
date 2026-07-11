'use strict';

/* Language-aware QR code for the quotation PDF/print view. Works in both
   a browser ('use client' print page) and a Node server component
   (the public /q/[token] page) — the 'qrcode' package renders PNGs
   itself in both environments, no native/canvas dependency needed. */

const QRCode = require('qrcode');

const LABELS = {
  en: {
    company: 'Company', quotation: 'Quotation No.', customer: 'Customer', date: 'Date',
    validUntil: 'Valid Until', total: 'Grand Total', contact: 'Contact', website: 'Website',
  },
  ar: {
    company: 'الشركة', quotation: 'رقم العرض', customer: 'العميل', date: 'التاريخ',
    validUntil: 'صالح حتى', total: 'الإجمالي', contact: 'التواصل', website: 'الموقع',
  },
};

/* Builds the plain-text payload encoded in the QR — entirely in the
   quotation's own output language (labels included), except identifiers
   that are meant to stay in their original form (numbers, email, phone,
   website), per spec. */
function buildQuoteQrText(lang, { entityName, quoteNumber, customerName, quoteDate, validUntil, grandTotal, currency, phone, email, website }) {
  const L = LABELS[lang === 'ar' ? 'ar' : 'en'];
  const lines = [
    `${L.company}: ${entityName || ''}`,
    `${L.quotation}: ${quoteNumber || ''}`,
    `${L.customer}: ${customerName || ''}`,
    `${L.date}: ${quoteDate || ''}`,
    `${L.validUntil}: ${validUntil || ''}`,
    `${L.total}: ${grandTotal || ''} ${currency || ''}`.trim(),
  ];
  const contactBits = [phone, email, website].filter(Boolean).join(' | ');
  if (contactBits) lines.push(`${L.contact}: ${contactBits}`);
  return lines.join('\n');
}

/* High-resolution (600x600) black-on-white PNG data URL with a proper
   quiet zone — stays sharp scaled down to a small on-page size and when
   printed to A4. errorCorrectionLevel 'M' keeps it reliably scannable
   even if a corner is lightly creased/cropped. */
async function buildQuoteQrDataUrl(text) {
  return QRCode.toDataURL(text, {
    margin: 2,
    width: 600,
    errorCorrectionLevel: 'M',
    color: { dark: '#1a1a18', light: '#ffffff' },
  });
}

module.exports = { buildQuoteQrText, buildQuoteQrDataUrl };
