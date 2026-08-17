'use strict';

/* One authoritative company identity for Accounting invoice documents.
   acc_settings may override the seller name/VAT at runtime; these values are
   the existing InvoiceDocument configuration moved here so the document and
   ZATCA endpoint cannot drift into separate company configurations. */
const INVOICE_COMPANY = Object.freeze({
  name_en: process.env.NEXT_PUBLIC_COMPANY_NAME_EN || 'ALFAROOQUE WOOD WORKS FACTORY',
  name_ar: process.env.NEXT_PUBLIC_COMPANY_NAME_AR || 'مصنع الفاروق للأعمال الخشبية',
  address_en: process.env.NEXT_PUBLIC_COMPANY_ADDRESS_EN || 'Bahara, Jeddah, Saudi Arabia',
  address_ar: process.env.NEXT_PUBLIC_COMPANY_ADDRESS_AR || 'بحرة، جدة، المملكة العربية السعودية',
  cr_number: process.env.NEXT_PUBLIC_COMPANY_CR || '4031098279',
  vat_number: process.env.NEXT_PUBLIC_COMPANY_VAT || '312048700900003',
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || '0564466661',
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || 'chairman@alfarooque.com',
  website: process.env.NEXT_PUBLIC_COMPANY_WEBSITE || '',
});

function resolveInvoiceSeller(settings = {}) {
  return {
    sellerName: String(settings.company_name || INVOICE_COMPANY.name_en || '').trim(),
    vatNumber: String(settings.vat_number || INVOICE_COMPANY.vat_number || '').trim(),
  };
}

module.exports = { INVOICE_COMPANY, resolveInvoiceSeller };
