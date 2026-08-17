'use strict';

const QRCode = require('qrcode');
const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { buildZatcaTlvBase64, ZatcaDataError } = require('@/lib/zatca');
const { resolveInvoiceSeller } = require('@/lib/invoiceCompany');

/* GET /api/invoices/[id]/qr — returns a data: URL PNG of the ZATCA Phase 1
   QR code for this invoice, built from company settings (acc_settings)
   + the invoice's own total/VAT. Rendered server-side so the Node
   Buffer-based TLV encoder never needs to ship to the browser bundle. */
export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const sb = getDb();
  const { data: invoice } = await sb.from('acc_invoices').select('*').eq('id', params.id).maybeSingle();
  if (!invoice) return json({ error: 'Invoice not found.' }, 404);

  const { data: settings } = await sb.from('acc_settings').select('company_name, vat_number').maybeSingle();

  try {
    const seller = resolveInvoiceSeller(settings || {});
    const tlvBase64 = buildZatcaTlvBase64({
      sellerName: seller.sellerName,
      vatNumber: seller.vatNumber,
      timestamp: invoice.created_at || invoice.invoice_date,
      total: invoice.total_amount,
      vatTotal: invoice.tax_amount,
    });
    const dataUrl = await QRCode.toDataURL(tlvBase64, { errorCorrectionLevel: 'M', margin: 4, width: 360 });
    return json({ dataUrl, payload: tlvBase64 });
  } catch (error) {
    if (error instanceof ZatcaDataError) return json({ error: error.message, missing_field: error.field }, 422);
    throw error;
  }
}
