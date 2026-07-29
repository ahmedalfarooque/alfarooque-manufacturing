'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();

  const [
    { count: totalProducts },
    { count: totalMaterials },
    { count: pendingPRs },
    { count: pendingPOs },
    { data: stockRows },
    { data: recentMovements },
    { data: recentReceipts },
    { data: lowStockProducts },
    { data: lowStockMaterials },
  ] = await Promise.all([
    sb.from('inv_products').select('id', { count: 'exact', head: true }).eq('is_active', true),
    sb.from('inv_materials').select('id', { count: 'exact', head: true }).eq('is_active', true),
    sb.from('inv_purchase_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('inv_purchase_orders').select('id', { count: 'exact', head: true }).in('status', ['pending', 'ordered']),
    sb.from('inv_stock').select('qty_on_hand, avg_cost'),
    sb.from('inv_stock_movements').select('*, inv_products(name), inv_materials(name)')
      .order('created_at', { ascending: false }).limit(5),
    sb.from('inv_goods_receipts').select('*, inv_suppliers(name)')
      .order('receipt_date', { ascending: false }).limit(5),
    sb.from('inv_products').select('id, name, sku, qty_on_hand, min_stock_qty')
      .eq('is_active', true).filter('qty_on_hand', 'lte', 'min_stock_qty').limit(10),
    sb.from('inv_materials').select('id, name, material_code, qty_on_hand, min_stock_qty')
      .eq('is_active', true).filter('qty_on_hand', 'lte', 'min_stock_qty').limit(10),
  ]);

  const stockValue = (stockRows || []).reduce((sum, r) => sum + Number(r.qty_on_hand || 0) * Number(r.avg_cost || 0), 0);
  const outOfStock = (stockRows || []).filter(r => Number(r.qty_on_hand || 0) <= 0).length;
  const lowStockItems = [...(lowStockProducts || []), ...(lowStockMaterials || [])];

  const { data: warehouseStock } = await sb.from('inv_stock')
    .select('qty_on_hand, inv_warehouses(name)')
    .not('inv_warehouses', 'is', null);
  const byWarehouse = {};
  for (const r of warehouseStock || []) {
    const name = r.inv_warehouses?.name || 'Unknown';
    byWarehouse[name] = (byWarehouse[name] || 0) + Number(r.qty_on_hand || 0);
  }
  const stockByWarehouse = Object.entries(byWarehouse).map(([name, qty]) => ({ name, qty }));

  const { data: topProductRows } = await sb.from('inv_stock')
    .select('qty_on_hand, avg_cost, inv_products(name)')
    .not('inv_products', 'is', null)
    .order('avg_cost', { ascending: false })
    .limit(5);
  const topProducts = (topProductRows || []).map(r => ({
    name: r.inv_products?.name || 'Unknown',
    value: Number(r.qty_on_hand || 0) * Number(r.avg_cost || 0),
  }));

  return json({
    totalProducts: totalProducts || 0,
    totalMaterials: totalMaterials || 0,
    stockValue,
    lowStockCount: lowStockItems.length,
    outOfStock,
    pendingPRs: pendingPRs || 0,
    pendingPOs: pendingPOs || 0,
    recentMovements: recentMovements || [],
    recentReceipts: recentReceipts || [],
    lowStockItems,
    stockByWarehouse,
    topProducts,
  });
}
