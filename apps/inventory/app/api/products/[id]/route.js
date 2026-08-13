'use strict';

/* No more fallback onto the top-level `products` table here — that was
   the public marketing website's catalog, not any ERP source (see
   route.js in the parent folder for the full explanation). SmartLife-
   sourced rows are shown read-only straight from the list response (the
   browser already has the full row); this route only ever serves
   inv_products, so a SmartLife-sourced id simply won't be found here and
   is treated as read-only/not-locally-editable rather than silently
   matching zero rows in the wrong table. */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireDelete , requireAction } = require('@/lib/http');

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('inv_products')
    .select('*, inv_categories(name), inv_subcategories(name), inv_brands(name), inv_units(name, symbol)')
    .eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load product.' }, 500);
  if (!data) return json({ error: 'Product not found in the local catalog. SmartLife-sourced products are viewed from the list.' }, 404);

  const { data: stock } = await sb.from('inv_stock')
    .select('qty_on_hand, qty_reserved, avg_cost, last_cost, inv_warehouses(name), inv_locations(name)')
    .eq('product_id', params.id);

  return json({ product: { ...data, source_table: 'inv_products', read_only: false }, stock: stock || [] });
}

export async function PUT(req, { params }) {
  const { response, session } = await requireAction(req, 'edit');
  if (response) return response;
  const sb = getDb();

  const { data: existing } = await sb.from('inv_products').select('id').eq('id', params.id).maybeSingle();
  if (!existing) return json({ error: 'This product is not in the local catalog (likely SmartLife-sourced) and cannot be edited here.' }, 403);

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
  const { response, session } = await requireDelete(req);
  if (response) return response;
  const sb = getDb();

  const { data: existing } = await sb.from('inv_products').select('id').eq('id', params.id).maybeSingle();
  if (!existing) return json({ error: 'This product is not in the local catalog (likely SmartLife-sourced) and cannot be edited here.' }, 403);

  const { error } = await sb.from('inv_products').update({ is_active: false }).eq('id', params.id);
  if (error) return json({ error: 'Could not deactivate product.' }, 500);
  return json({ ok: true });
}
