'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
  const offset = (page - 1) * limit;

  const { data, count, error } = await sb.from('inv_stock_transfers')
    .select('*, from:inv_warehouses!from_warehouse_id(name), to:inv_warehouses!to_warehouse_id(name), platform_users!created_by(full_name), inv_stock_transfer_items(*, inv_products(name, sku), inv_materials(name, material_code))', { count: 'exact' })
    .order('transfer_date', { ascending: false }).range(offset, offset + limit - 1);
  if (error) return json({ error: 'Could not load stock transfers.' }, 500);
  return json({ transfers: data || [], total: count || 0, page, limit });
}

export async function POST(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

  const body = await req.json().catch(() => ({}));
  if (!body.from_warehouse_id) return json({ error: 'Source warehouse is required.' }, 400);
  if (!body.to_warehouse_id) return json({ error: 'Destination warehouse is required.' }, 400);
  if (body.from_warehouse_id === body.to_warehouse_id) return json({ error: 'Source and destination warehouses must differ.' }, 400);
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return json({ error: 'At least one item is required.' }, 400);

  for (const it of items) {
    const qty = Number(it.qty) || 0;
    if (!qty || qty <= 0) return json({ error: 'Each item needs a positive quantity.' }, 400);
    const { data: existing } = await sb.from('inv_stock')
      .select('qty_on_hand, qty_reserved')
      .eq('warehouse_id', body.from_warehouse_id)
      .eq(it.product_id ? 'product_id' : 'material_id', it.product_id || it.material_id)
      .maybeSingle();
    const available = existing ? Number(existing.qty_on_hand) - Number(existing.qty_reserved) : 0;
    if (available < qty) return json({ error: `Insufficient available stock at source warehouse (available: ${available}).` }, 400);
  }

  const { data: transfer, error: trErr } = await sb.from('inv_stock_transfers').insert({
    transfer_number: body.transfer_number || null,
    from_warehouse_id: body.from_warehouse_id,
    to_warehouse_id: body.to_warehouse_id,
    transfer_date: body.transfer_date || new Date().toISOString().slice(0, 10),
    notes: body.notes || null,
    created_by: session.sub,
  }).select().single();
  if (trErr) return json({ error: 'Could not create transfer.' }, 500);

  const itemRows = items.map(it => ({
    transfer_id: transfer.id,
    product_id: it.product_id || null,
    material_id: it.material_id || null,
    qty: Number(it.qty) || 0,
  }));
  await sb.from('inv_stock_transfer_items').insert(itemRows);

  const now = new Date().toISOString();
  for (const it of items) {
    const qty = Number(it.qty) || 0;
    const filter = it.product_id
      ? { product_id: it.product_id, material_id: null }
      : { material_id: it.material_id, product_id: null };

    const { data: fromStock } = await sb.from('inv_stock')
      .select('id, qty_on_hand, avg_cost')
      .eq('warehouse_id', body.from_warehouse_id)
      .eq(it.product_id ? 'product_id' : 'material_id', it.product_id || it.material_id)
      .maybeSingle();
    const fromNewQty = Math.max(0, (fromStock ? Number(fromStock.qty_on_hand) : 0) - qty);
    if (fromStock) await sb.from('inv_stock').update({ qty_on_hand: fromNewQty, updated_at: now }).eq('id', fromStock.id);

    const unitCost = fromStock ? Number(fromStock.avg_cost) || 0 : 0;
    const { data: toStock } = await sb.from('inv_stock')
      .select('id, qty_on_hand, avg_cost')
      .eq('warehouse_id', body.to_warehouse_id)
      .eq(it.product_id ? 'product_id' : 'material_id', it.product_id || it.material_id)
      .maybeSingle();

    if (toStock) {
      const oldQty = Number(toStock.qty_on_hand) || 0;
      const oldCost = Number(toStock.avg_cost) || 0;
      const newQty = oldQty + qty;
      const newAvgCost = newQty > 0 ? ((oldQty * oldCost) + (qty * unitCost)) / newQty : unitCost;
      await sb.from('inv_stock').update({ qty_on_hand: newQty, avg_cost: newAvgCost, updated_at: now }).eq('id', toStock.id);
    } else {
      await sb.from('inv_stock').insert({
        warehouse_id: body.to_warehouse_id,
        ...filter,
        qty_on_hand: qty,
        qty_reserved: 0,
        avg_cost: unitCost,
        last_cost: unitCost,
      });
    }

    await sb.from('inv_stock_movements').insert([
      {
        warehouse_id: body.from_warehouse_id, ...filter,
        movement_type: 'transfer_out', qty, unit_cost: unitCost,
        reference: transfer.transfer_number || transfer.id, reference_type: 'stock_transfer', reference_id: transfer.id,
        created_by: session.sub,
      },
      {
        warehouse_id: body.to_warehouse_id, ...filter,
        movement_type: 'transfer_in', qty, unit_cost: unitCost,
        reference: transfer.transfer_number || transfer.id, reference_type: 'stock_transfer', reference_id: transfer.id,
        created_by: session.sub,
      },
    ]);
  }

  return json({ transfer }, 201);
}
