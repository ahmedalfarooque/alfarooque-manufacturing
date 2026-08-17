'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { classifySmartErpError } = require('../../../../../shared/integrationPlatform');
const { buildVatReport, readLocalFinancialRecords } = require('@/lib/financialReportData');

export async function GET(req) {
  const { response } = await requireAction(req, 'view'); if (response) return response;
  const url = new URL(req.url);
  const month = url.searchParams.get('month') || 'all';
  const year = url.searchParams.get('year') || 'all';
  const from = url.searchParams.get('from') || '';
  const to = url.searchParams.get('to') || '';
  try {
    const sb = getDb();
    const [sales, purchases] = await Promise.all([
      readLocalFinancialRecords(sb, 'sales_invoice'),
      readLocalFinancialRecords(sb, 'purchase_invoice'),
    ]);
    return json({
      source: 'SmartLife synchronized local snapshot', connected: true,
      ...buildVatReport(sales.records, purchases.records, month, year, from, to),
      sourceCounts: { sales: sales.records.length, purchases: purchases.records.length },
    });
  } catch (error) {
    const classification = classifySmartErpError(error);
    const status = classification === 'permission_required' ? 403 : 502;
    return json({
      connected: false,
      permission_required: classification === 'permission_required',
      connection_error: classification === 'connection_error',
      error: error?.message || 'VAT data source is unavailable.',
    }, status);
  }
}
