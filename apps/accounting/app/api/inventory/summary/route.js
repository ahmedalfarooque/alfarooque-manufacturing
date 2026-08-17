'use strict';

/* Inventory KPI aggregation — reuses the existing central connector's
   readAllSmartLife() (same function the sync job uses) against the SAME
   'products' resource already verified for the Products module. No new
   SmartERP endpoint, no second data source, no duplicated stock table —
   this only computes counts/sums over the real synced product snapshot
   so the browser isn't shipped all 2,912 rows just to show KPI numbers. */

const { json, requireSession , requireAction } = require('@/lib/http');
const { readAllSmartLife } = require('../../../../../shared/integrationPlatform');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  let records;
  try {
    const result = await readAllSmartLife(null, 'products', { limit: '500' }, { maxPages: 20 });
    records = result.records;
  } catch (error) {
    return json({ error: error.message || 'Could not load product data.' }, 502);
  }

  const withStock = records.filter(r => Number(r.quantity) > 0);
  const outOfStock = records.filter(r => Number(r.quantity) <= 0);
  /* alert_quantity is a real field but only meaningfully set (non-zero) on
     570 of 2,912 real products — "low stock" is only computable for those;
     everything else has no real threshold to compare against. */
  const withThreshold = records.filter(r => Number(r.alert_quantity) > 0);
  const lowStock = withThreshold.filter(r => Number(r.quantity) > 0 && Number(r.quantity) <= Number(r.alert_quantity));
  const totalQuantity = records.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  const categories = [...new Set(records.map(r => String(r.category || '').trim()).filter(Boolean))].sort();
  const units = [...new Set(records.map(r => r.unit).filter(Boolean))];

  return json({
    totalProducts: records.length,
    withStock: withStock.length,
    outOfStock: outOfStock.length,
    withThreshold: withThreshold.length,
    lowStock: lowStock.length,
    totalQuantity,
    categories,
    units,
    notes: {
      warehouseStock: 'Not available — every real product record has warehouse=null; SmartLife\'s Products API does not expose a per-warehouse stock breakdown.',
      lowStockCoverage: `Low-stock threshold is only meaningful for ${withThreshold.length} of ${records.length} products — the rest have no alert_quantity set.`,
    },
  });
}
