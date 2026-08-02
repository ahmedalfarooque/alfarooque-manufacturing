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
  }

  if (type === 'all' || type === 'materials') {
    const { data } = await sb.from('inv_materials')
      .select('id, material_code, name, name_ar, qty_on_hand, cost_price')
      .eq('is_active', true)
      .or(`name.ilike.${pattern},material_code.ilike.${pattern}`)
      .order('name')
      .limit(10);
    results.materials = data || [];
  }

  return json(results);
}
