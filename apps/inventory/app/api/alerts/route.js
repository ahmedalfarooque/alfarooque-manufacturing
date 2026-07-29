'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const url = new URL(req.url);
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10));

  const [{ data: lowProducts }, { data: lowMaterials }] = await Promise.all([
    sb.from('inv_products').select('id, name, sku, qty_on_hand, min_stock_qty')
      .eq('is_active', true).filter('qty_on_hand', 'lte', 'min_stock_qty').limit(limit),
    sb.from('inv_materials').select('id, name, material_code, qty_on_hand, min_stock_qty')
      .eq('is_active', true).filter('qty_on_hand', 'lte', 'min_stock_qty').limit(limit),
  ]);

  const alerts = [
    ...(lowProducts || []).map(p => ({
      type: 'low_stock_product', id: p.id, name: p.name, code: p.sku,
      qty_on_hand: p.qty_on_hand, min_stock_qty: p.min_stock_qty,
      href: '/products/' + p.id,
    })),
    ...(lowMaterials || []).map(m => ({
      type: 'low_stock_material', id: m.id, name: m.name, code: m.material_code,
      qty_on_hand: m.qty_on_hand, min_stock_qty: m.min_stock_qty,
      href: '/materials/' + m.id,
    })),
  ];

  return json({ alerts });
}
