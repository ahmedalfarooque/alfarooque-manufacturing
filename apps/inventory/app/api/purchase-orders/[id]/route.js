'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('inv_purchase_orders')
    .select('*, inv_suppliers(name, email, phone), inv_purchase_order_items(*, inv_products(name, sku), inv_materials(name, material_code))')
    .eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load purchase order.' }, 500);
  if (!data) return json({ error: 'Purchase order not found.' }, 404);
  return json({ order: data });
}

export async function PUT(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);

  const body = await req.json().catch(() => ({}));
  const { data: po } = await sb.from('inv_purchase_orders').select('status').eq('id', params.id).maybeSingle();
  if (!po) return json({ error: 'Purchase order not found.' }, 404);

  if (body.action === 'send') {
    if (!can(invRole, 'approve')) return json({ error: 'Approve permission required.' }, 403);
    await sb.from('inv_purchase_orders').update({ status: 'ordered', ordered_at: new Date().toISOString() }).eq('id', params.id);
    return json({ ok: true });
  }

  if (body.action === 'cancel') {
    if (!can(invRole, 'approve')) return json({ error: 'Approve permission required.' }, 403);
    await sb.from('inv_purchase_orders').update({ status: 'cancelled' }).eq('id', params.id);
    return json({ ok: true });
  }

  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);
  if (!['pending'].includes(po.status)) return json({ error: 'Cannot edit a processed order.' }, 400);

  const items = Array.isArray(body.items) ? body.items : null;
  const totalAmount = items
    ? items.reduce((s, it) => s + (Number(it.qty_ordered) || 0) * (Number(it.unit_cost) || 0), 0)
    : undefined;

  const update = {
    supplier_id: body.supplier_id,
    expected_delivery: body.expected_delivery || null,
    delivery_address: body.delivery_address || null,
    notes: body.notes || null,
    currency: body.currency || 'SAR',
  };
  if (totalAmount !== undefined) update.total_amount = totalAmount;

  await sb.from('inv_purchase_orders').update(update).eq('id', params.id);

  if (items) {
    await sb.from('inv_purchase_order_items').delete().eq('po_id', params.id);
    const itemRows = items.map(it => ({
      po_id: params.id,
      product_id: it.product_id || null,
      material_id: it.material_id || null,
      description: it.description || null,
      qty_ordered: Number(it.qty_ordered) || 1,
      qty_received: 0,
      unit_cost: Number(it.unit_cost) || 0,
    }));
    await sb.from('inv_purchase_order_items').insert(itemRows);
  }

  return json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'admin')) return json({ error: 'Admin access required.' }, 403);

  await sb.from('inv_purchase_order_items').delete().eq('po_id', params.id);
  const { error } = await sb.from('inv_purchase_orders').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete purchase order.' }, 500);
  return json({ ok: true });
}
