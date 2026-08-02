'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status') || 'active';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
  const offset = (page - 1) * limit;

  let q = sb.from('inv_stock_reservations')
    .select('*, inv_products(name, sku), inv_materials(name, material_code), inv_warehouses(name), platform_users!reserved_by(full_name)', { count: 'exact' });
  if (status !== 'all') q = q.eq('status', status);

  const { data, count, error } = await q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) return json({ error: 'Could not load reservations.' }, 500);
  return json({ reservations: data || [], total: count || 0, page, limit });
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
  const qty = Number(body.qty) || 0;
  if (!qty || qty <= 0) return json({ error: 'Reservation quantity must be positive.' }, 400);

  const { data: existing } = await sb.from('inv_stock')
    .select('id, qty_on_hand, qty_reserved')
    .eq('warehouse_id', body.warehouse_id)
    .eq(body.product_id ? 'product_id' : 'material_id', body.product_id || body.material_id)
    .maybeSingle();
  const available = existing ? Number(existing.qty_on_hand) - Number(existing.qty_reserved) : 0;
  if (available < qty) return json({ error: `Insufficient available stock (available: ${available}).` }, 400);

  await sb.from('inv_stock').update({ qty_reserved: Number(existing.qty_reserved) + qty, updated_at: new Date().toISOString() }).eq('id', existing.id);

  const { data: reservation, error } = await sb.from('inv_stock_reservations').insert({
    product_id: body.product_id || null,
    material_id: body.material_id || null,
    warehouse_id: body.warehouse_id,
    qty,
    status: 'active',
    reference_type: body.reference_type || 'other',
    reference_id: body.reference_id || null,
    reference_label: body.reference_label || null,
    notes: body.notes || null,
    reserved_by: session.sub,
  }).select().single();
  if (error) return json({ error: 'Could not create reservation.' }, 500);

  return json({ reservation }, 201);
}
