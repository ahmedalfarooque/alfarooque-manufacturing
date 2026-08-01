'use strict';

/* GET /api/inventory-search?q=<term>
   Searches inv_products (spare parts) in the shared Supabase database.
   Used by the maintenance-record form to link structured parts. */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();

  if (q.length < 2) return json({ products: [] });

  const sb = getDb();
  const pattern = `%${q}%`;

  const { data } = await sb.from('inv_products')
    .select('id, sku, name, name_ar, qty_on_hand, cost_price')
    .eq('is_active', true)
    .or(`name.ilike.${pattern},sku.ilike.${pattern},barcode.ilike.${pattern}`)
    .order('name')
    .limit(10);

  return json({ products: data || [] });
}
