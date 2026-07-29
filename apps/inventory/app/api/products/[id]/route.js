'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('inv_products')
    .select('*, inv_categories(name), inv_subcategories(name), inv_brands(name), inv_units(name, symbol)')
    .eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load product.' }, 500);
  if (!data) return json({ error: 'Product not found.' }, 404);

  const { data: stock } = await sb.from('inv_stock')
    .select('qty_on_hand, qty_reserved, avg_cost, last_cost, inv_warehouses(name), inv_locations(name)')
    .eq('product_id', params.id);

  return json({ product: data, stock: stock || [] });
}

export async function PUT(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

  const body = await req.json().catch(() => ({}));
  const { error } = await sb.from('inv_products').update({
    name: body.name,
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
    is_active: body.is_active !== false,
  }).eq('id', params.id);
  if (error) return json({ error: 'Could not update product.' }, 500);
  return json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'admin')) return json({ error: 'Admin access required.' }, 403);

  const { error } = await sb.from('inv_products').update({ is_active: false }).eq('id', params.id);
  if (error) return json({ error: 'Could not deactivate product.' }, 500);
  return json({ ok: true });
}
