'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');
const { syncItemQty } = require('@/lib/stockSync');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouse_id');
  const type = searchParams.get('type') || 'all'; // 'product' | 'material' | 'all'
  const search = searchParams.get('search') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(200, parseInt(searchParams.get('limit') || '50', 10));
  const offset = (page - 1) * limit;

  let q = sb.from('inv_stock')
    .select('*, inv_products(id, name, sku), inv_materials(id, name, material_code), inv_warehouses(name), inv_locations(name)', { count: 'exact' });
  if (warehouseId) q = q.eq('warehouse_id', warehouseId);
  if (type === 'product') q = q.not('product_id', 'is', null);
  if (type === 'material') q = q.not('material_id', 'is', null);

  const { data, count, error } = await q.order('updated_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) return json({ error: 'Could not load stock.' }, 500);

  let rows = data || [];
  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(r =>
      r.inv_products?.name?.toLowerCase().includes(s) ||
      r.inv_products?.sku?.toLowerCase().includes(s) ||
      r.inv_materials?.name?.toLowerCase().includes(s) ||
      r.inv_materials?.material_code?.toLowerCase().includes(s)
    );
  }

  return json({ stock: rows, total: count || 0, page, limit });
}

export async function POST(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

  const body = await req.json().catch(() => ({}));
  if (!body.warehouse_id) return json({ error: 'Warehouse is required.' }, 400);
  if (!body.product_id && !body.material_id) return json({ error: 'Product or material is required.' }, 400);
  const qty = Number(body.qty_adjustment || 0);
  if (!qty) return json({ error: 'Adjustment quantity is required.' }, 400);

  const filter = body.product_id
    ? { product_id: body.product_id, material_id: null }
    : { material_id: body.material_id, product_id: null };

  const { data: existing } = await sb.from('inv_stock')
    .select('id, qty_on_hand, avg_cost')
    .eq('warehouse_id', body.warehouse_id)
    .eq(body.product_id ? 'product_id' : 'material_id', body.product_id || body.material_id)
    .maybeSingle();

  const newQty = Math.max(0, (existing ? Number(existing.qty_on_hand) : 0) + qty);
  const now = new Date().toISOString();

  if (existing) {
    await sb.from('inv_stock').update({ qty_on_hand: newQty, updated_at: now }).eq('id', existing.id);
  } else {
    await sb.from('inv_stock').insert({
      warehouse_id: body.warehouse_id,
      location_id: body.location_id || null,
      ...filter,
      qty_on_hand: newQty,
      qty_reserved: 0,
      avg_cost: body.cost || 0,
      last_cost: body.cost || 0,
    });
  }

  await sb.from('inv_stock_movements').insert({
    warehouse_id: body.warehouse_id,
    location_id: body.location_id || null,
    ...filter,
    movement_type: qty > 0 ? 'adjustment_in' : 'adjustment_out',
    qty: Math.abs(qty),
    unit_cost: body.cost || 0,
    reference: body.reference || null,
    notes: body.notes || null,
    created_by: session.sub,
  });

  await syncItemQty(sb, { productId: body.product_id || null, materialId: body.material_id || null });

  return json({ ok: true, qty_on_hand: newQty });
}
