'use strict';

/* GET /api/inventory-search?q=<term>&type=all|products|materials
   Queries inv_* tables directly (same Supabase project) so bill lines can
   link to a specific inventory item when the purchase destination is a
   warehouse. Mirrors apps/quotation, apps/projects, apps/cars. */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const type = url.searchParams.get('type') || 'all';

  if (q.length < 2) return json({ products: [], materials: [] });

  const sb = getDb();
  const pattern = `%${q}%`;
  const results = { products: [], materials: [] };

  if (type === 'all' || type === 'products') {
    const { data } = await sb.from('inv_products')
      .select('id, sku, name, name_ar, qty_on_hand, cost_price, selling_price')
      .eq('is_active', true)
      .or(`name.ilike.${pattern},sku.ilike.${pattern},barcode.ilike.${pattern}`)
      .order('name')
      .limit(10);
    results.products = data || [];
    if (!results.products.length) {
      const { data: legacy } = await sb.from('products')
        .select('id, sku, name, name_ar, stock, price').eq('is_active', true)
        .or(`name.ilike.${pattern},sku.ilike.${pattern}`).order('name').limit(10);
      results.products = (legacy || []).map(row => ({ ...row, qty_on_hand: row.stock || 0, selling_price: row.price, cost_price: 0, source_table: 'products' }));
    }
  }

  if (type === 'all' || type === 'materials') {
    const { data } = await sb.from('inv_materials')
      .select('id, material_code, name, name_ar, qty_on_hand, cost_price')
      .eq('is_active', true)
      .or(`name.ilike.${pattern},material_code.ilike.${pattern}`)
      .order('name')
      .limit(10);
    results.materials = data || [];
    if (!results.materials.length) {
      const { data: legacy } = await sb.from('qt_materials')
        .select('id, code, name, name_ar, latest_price').is('deleted_at', null)
        .or(`name.ilike.${pattern},code.ilike.${pattern}`).order('name').limit(10);
      results.materials = (legacy || []).map(row => ({ ...row, material_code: row.code, qty_on_hand: 0, cost_price: row.latest_price || 0, source_table: 'qt_materials' }));
    }
  }

  return json(results);
}
