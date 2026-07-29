'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(200, parseInt(searchParams.get('limit') || '50', 10));
  const offset = (page - 1) * limit;
  const productId = searchParams.get('product_id');
  const materialId = searchParams.get('material_id');
  const warehouseId = searchParams.get('warehouse_id');
  const movementType = searchParams.get('movement_type');

  let q = sb.from('inv_stock_movements')
    .select('*, inv_products(name, sku), inv_materials(name, material_code), inv_warehouses(name), platform_users(full_name)', { count: 'exact' });
  if (productId) q = q.eq('product_id', productId);
  if (materialId) q = q.eq('material_id', materialId);
  if (warehouseId) q = q.eq('warehouse_id', warehouseId);
  if (movementType) q = q.eq('movement_type', movementType);

  const { data, count, error } = await q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) return json({ error: 'Could not load stock movements.' }, 500);
  return json({ movements: data || [], total: count || 0, page, limit });
}
