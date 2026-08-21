'use strict';

const QRCode = require('qrcode');
const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { resolveSmartLifeDocument } = require('@/lib/smartlifeDocument');
const { buildSalesInvoiceZatcaData, ZatcaDataError } = require('@/lib/zatca');
const { resolveInvoiceSeller } = require('@/lib/invoiceCompany');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  /* Was: a LIST-endpoint search only, which is why a real invoice reported
     "not found" and the page showed "ZATCA QR unavailable". Now the shared
     resolver is used (snapshot → SmartERP detail → list), the same order
     every other document surface uses. The QR itself is unchanged: still a
     genuine ZATCA TLV payload built from the invoice's own seller/VAT/
     timestamp/total/VAT-total values — never a fabricated or
     invoice-number-only code. */
  const { record: invoice, liveFailed } = await resolveSmartLifeDocument(req, 'sales-invoices', params.id);
  if (!invoice) {
    return json({
      error: liveFailed
        ? 'The sales invoice could not be retrieved from SmartERP right now, so the ZATCA QR cannot be built yet.'
        : 'This sales invoice does not exist in SmartERP.',
    }, liveFailed ? 502 : 404);
  }

  const { data: settings, error: settingsError } = await getDb()
    .from('acc_settings').select('company_name,vat_number').maybeSingle();
  if (settingsError) return json({ error: 'Could not load the authoritative Accounting seller settings.' }, 500);

  try {
    const zatca = buildSalesInvoiceZatcaData(invoice, resolveInvoiceSeller(settings || {}));
    const dataUrl = await QRCode.toDataURL(zatca.payload, {
      errorCorrectionLevel: 'M', margin: 4, width: 360, type: 'image/png',
      color: { dark: '#000000', light: '#FFFFFF' },
    });
    return json({ payload: zatca.payload, fields: zatca.fields, dataUrl, source: 'invoice-data' });
  } catch (error) {
    if (error instanceof ZatcaDataError) return json({ error: error.message, missing_field: error.field }, 422);
    console.error('[smartlife sales invoice ZATCA] generation failed:', error.message);
    return json({ error: 'Could not generate the ZATCA QR.' }, 500);
  }
}
