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
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
  const offset = (page - 1) * limit;

  const { data, count, error } = await sb.from('inv_goods_receipts')
    .select('*, inv_suppliers(name), inv_warehouses(name), platform_users!received_by(full_name), inv_goods_receipt_items(*)', { count: 'exact' })
    .order('receipt_date', { ascending: false }).range(offset, offset + limit - 1);
  if (error) return json({ error: 'Could not load goods receipts.' }, 500);
  return json({ receipts: data || [], total: count || 0, page, limit });
}

export async function POST(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

  const body = await req.json().catch(() => ({}));
  if (!body.supplier_id) return json({ error: 'Supplier is required.' }, 400);
  if (!body.warehouse_id) return json({ error: 'Warehouse is required.' }, 400);
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return json({ error: 'At least one item is required.' }, 400);

  const { data: gr, error: grErr } = await sb.from('inv_goods_receipts').insert({
    gr_number: body.gr_number || null,
    po_id: body.po_id || null,
    supplier_id: body.supplier_id,
    warehouse_id: body.warehouse_id,
    receipt_date: body.receipt_date || new Date().toISOString().slice(0, 10),
    delivery_note: body.delivery_note || null,
    invoice_number: body.invoice_number || null,
    notes: body.notes || null,
    received_by: session.sub,
  }).select().single();
  if (grErr) return json({ error: 'Could not create goods receipt.' }, 500);

  const itemRows = items.map(it => ({
    gr_id: gr.id,
    product_id: it.product_id || null,
    material_id: it.material_id || null,
    po_item_id: it.po_item_id || null,
    qty_received: Number(it.qty_received) || 0,
    unit_cost: Number(it.unit_cost) || 0,
    location_id: it.location_id || null,
  }));
  await sb.from('inv_goods_receipt_items').insert(itemRows);

  for (const it of items) {
    const qty = Number(it.qty_received) || 0;
    if (!qty) continue;
    const filter = it.product_id
      ? { product_id: it.product_id, material_id: null }
      : { material_id: it.material_id, product_id: null };

    const { data: existing } = await sb.from('inv_stock')
      .select('id, qty_on_hand, avg_cost')
      .eq('warehouse_id', body.warehouse_id)
      .eq(it.product_id ? 'product_id' : 'material_id', it.product_id || it.material_id)
      .maybeSingle();

    if (existing) {
      const oldQty = Number(existing.qty_on_hand) || 0;
      const oldCost = Number(existing.avg_cost) || 0;
      const unitCost = Number(it.unit_cost) || 0;
      const newQty = oldQty + qty;
      const newAvgCost = newQty > 0 ? ((oldQty * oldCost) + (qty * unitCost)) / newQty : unitCost;
      await sb.from('inv_stock').update({ qty_on_hand: newQty, avg_cost: newAvgCost, last_cost: unitCost }).eq('id', existing.id);
    } else {
      await sb.from('inv_stock').insert({
        warehouse_id: body.warehouse_id,
        location_id: it.location_id || null,
        ...filter,
        qty_on_hand: qty,
        qty_reserved: 0,
        avg_cost: it.unit_cost || 0,
        last_cost: it.unit_cost || 0,
      });
    }

    await sb.from('inv_stock_movements').insert({
      warehouse_id: body.warehouse_id,
      location_id: it.location_id || null,
      ...filter,
      movement_type: 'receipt',
      qty,
      unit_cost: it.unit_cost || 0,
      reference: gr.gr_number || gr.id,
      reference_type: 'goods_receipt',
      reference_id: gr.id,
      created_by: session.sub,
    });

    if (it.po_item_id) {
      const { data: poItem } = await sb.from('inv_purchase_order_items').select('qty_received').eq('id', it.po_item_id).maybeSingle();
      if (poItem) await sb.from('inv_purchase_order_items').update({ qty_received: Number(poItem.qty_received || 0) + qty }).eq('id', it.po_item_id);
    }

    await syncItemQty(sb, { productId: it.product_id || null, materialId: it.material_id || null });
  }

  return json({ receipt: gr }, 201);
}
