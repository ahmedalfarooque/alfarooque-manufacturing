'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { readAllSmartLife, classifySmartErpError } = require('../../../../../shared/integrationPlatform');
const { buildVatReport } = require('@/lib/financialReportData');

export async function GET(req) {
  const { response } = await requireAction(req, 'view'); if (response) return response;
  const url = new URL(req.url);
  const month = url.searchParams.get('month') || 'all';
  const year = url.searchParams.get('year') || 'all';
  try {
    const sb = getDb();
    const [sales, purchases] = await Promise.all([
      readAllSmartLife(sb, 'sales-invoices', { limit: '500' }, { maxPages: 20 }),
      readAllSmartLife(sb, 'purchases', { limit: '500' }, { maxPages: 20 }),
    ]);
    return json({
      source: 'SmartLife live read-only data', connected: true,
      ...buildVatReport(sales.records, purchases.records, month, year),
      sourceCounts: { sales: sales.total, purchases: purchases.total },
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
