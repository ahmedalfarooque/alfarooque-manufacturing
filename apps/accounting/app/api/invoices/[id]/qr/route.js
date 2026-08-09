'use strict';

const QRCode = require('qrcode');
const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { buildZatcaTlvBase64 } = require('@/lib/zatca');

/* GET /api/invoices/[id]/qr — returns a data: URL PNG of the ZATCA Phase 1
   QR code for this invoice, built from company settings (acc_settings)
   + the invoice's own total/VAT. Rendered server-side so the Node
   Buffer-based TLV encoder never needs to ship to the browser bundle. */
export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data: invoice } = await sb.from('acc_invoices').select('*').eq('id', params.id).maybeSingle();
  if (!invoice) return json({ error: 'Invoice not found.' }, 404);

  const { data: settings } = await sb.from('acc_settings').select('company_name, vat_number').maybeSingle();

  const tlvBase64 = buildZatcaTlvBase64({
    sellerName: settings?.company_name || 'AL FAROOQUE Manufacturing',
    vatNumber: settings?.vat_number || '',
    timestamp: invoice.invoice_date ? new Date(invoice.invoice_date).toISOString() : new Date().toISOString(),
    total: invoice.total_amount,
    vatTotal: invoice.tax_amount,
  });

  const dataUrl = await QRCode.toDataURL(tlvBase64, { margin: 1, width: 180 });
  return json({ dataUrl });
}
