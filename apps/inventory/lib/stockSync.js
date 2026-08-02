'use strict';

/* Keeps the denormalized inv_products.qty_on_hand / inv_materials.qty_on_hand
   totals (sum across all warehouses) in sync after any inv_stock mutation.
   Call this after every write to inv_stock — goods receipts, goods issues,
   transfers, and manual adjustments all touch it. Without this, the
   denormalized column stays at its default (0) forever, which is what every
   Products/Materials list page and the cross-app inventory-search endpoints
   in quotation/projects/cars read for on-hand quantity. */
async function syncItemQty(sb, { productId, materialId }) {
  if (!productId && !materialId) return;
  const col = productId ? 'product_id' : 'material_id';
  const id = productId || materialId;
  const table = productId ? 'inv_products' : 'inv_materials';

  const { data } = await sb.from('inv_stock').select('qty_on_hand').eq(col, id);
  const total = (data || []).reduce((sum, row) => sum + Number(row.qty_on_hand || 0), 0);
  await sb.from(table).update({ qty_on_hand: total, updated_at: new Date().toISOString() }).eq('id', id);
}

module.exports = { syncItemQty };
