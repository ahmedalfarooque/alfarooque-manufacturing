'use strict';

const QRCode = require('qrcode');
const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { parseCookies, COOKIE_NAME } = require('@/lib/auth');
const { SSO_COOKIE_NAME } = require('@/lib/sso');
const { readSmartLife } = require('@/lib/smartlife');
const { buildSalesInvoiceZatcaData, ZatcaDataError } = require('@/lib/zatca');
const { resolveInvoiceSeller } = require('@/lib/invoiceCompany');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sameInvoice(record, id) {
  return ['id', 'invoice_id', 'reference_no', 'invoice_number', 'number', 'reference']
    .some(key => String(record?.[key] ?? '') === String(id));
}

async function loadInvoice(req, id) {
  const cookies = parseCookies(req.headers.get('cookie'));
  try {
    const result = await readSmartLife('sales-invoices', {
      appToken: cookies[COOKIE_NAME], ssoToken: cookies[SSO_COOKIE_NAME],
    }, { search: String(id), limit: '100' });
    return result.records.find(record => sameInvoice(record, id)) || null;
  } catch (error) {
    const records = Array.isArray(error?.centralPayload?.records) ? error.centralPayload.records : [];
    return records.find(record => sameInvoice(record, id)) || null;
  }
}

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const invoice = await loadInvoice(req, params.id);
  if (!invoice) return json({ error: 'Sales invoice not found in the live source or synchronized snapshot.' }, 404);

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
