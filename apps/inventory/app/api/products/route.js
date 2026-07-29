'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
  const offset = (page - 1) * limit;
  const categoryId = searchParams.get('category_id');

  let q = sb.from('inv_products')
    .select('*, inv_categories(name), inv_units(name, symbol)', { count: 'exact' });
  if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
  if (categoryId) q = q.eq('category_id', categoryId);
  const activeParam = searchParams.get('active');
  if (activeParam !== null) q = q.eq('is_active', activeParam !== 'false');

  const { data, count, error } = await q.order('name', { ascending: true }).range(offset, offset + limit - 1);
  if (error) return json({ error: 'Could not load products.' }, 500);
  return json({ products: data || [], total: count || 0, page, limit });
}

export async function POST(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'Product name is required.' }, 400);

  const { data, error } = await sb.from('inv_products').insert({
    name,
    sku: body.sku || null,
    barcode: body.barcode || null,
    description: body.description || null,
    category_id: body.category_id || null,
    subcategory_id: body.subcategory_id || null,
    brand_id: body.brand_id || null,
    unit_id: body.unit_id || null,
    cost_price: body.cost_price || 0,
    selling_price: body.selling_price || 0,
    min_stock_qty: body.min_stock_qty || 0,
    max_stock_qty: body.max_stock_qty || null,
    qty_on_hand: 0,
    is_active: true,
  }).select().single();
  if (error) return json({ error: 'Could not add product.' }, 500);
  return json({ product: data }, 201);
}
