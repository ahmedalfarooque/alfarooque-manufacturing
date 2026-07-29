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
  const status = searchParams.get('status');

  let q = sb.from('inv_purchase_orders')
    .select('*, inv_suppliers(name), platform_users!created_by(full_name), inv_purchase_order_items(*)', { count: 'exact' });
  if (status) q = q.eq('status', status);

  const { data, count, error } = await q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) return json({ error: 'Could not load purchase orders.' }, 500);
  return json({ orders: data || [], total: count || 0, page, limit });
}

export async function POST(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

  const body = await req.json().catch(() => ({}));
  if (!body.supplier_id) return json({ error: 'Supplier is required.' }, 400);
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return json({ error: 'At least one item is required.' }, 400);

  const totalAmount = items.reduce((s, it) => s + (Number(it.qty_ordered) || 0) * (Number(it.unit_cost) || 0), 0);

  const { data: po, error: poErr } = await sb.from('inv_purchase_orders').insert({
    po_number: body.po_number || null,
    supplier_id: body.supplier_id,
    pr_id: body.pr_id || null,
    status: 'pending',
    total_amount: totalAmount,
    currency: body.currency || 'SAR',
    expected_delivery: body.expected_delivery || null,
    delivery_address: body.delivery_address || null,
    notes: body.notes || null,
    created_by: session.sub,
  }).select().single();
  if (poErr) return json({ error: 'Could not create purchase order.' }, 500);

  const itemRows = items.map(it => ({
    po_id: po.id,
    product_id: it.product_id || null,
    material_id: it.material_id || null,
    description: it.description || null,
    qty_ordered: Number(it.qty_ordered) || 1,
    qty_received: 0,
    unit_cost: Number(it.unit_cost) || 0,
  }));
  await sb.from('inv_purchase_order_items').insert(itemRows);

  return json({ order: po }, 201);
}
