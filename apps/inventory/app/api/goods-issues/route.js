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

  const { data, count, error } = await sb.from('inv_goods_issues')
    .select('*, inv_warehouses(name), platform_users!issued_by(full_name), inv_goods_issue_items(*, inv_products(name, sku), inv_materials(name, material_code))', { count: 'exact' })
    .order('issue_date', { ascending: false }).range(offset, offset + limit - 1);
  if (error) return json({ error: 'Could not load goods issues.' }, 500);
  return json({ issues: data || [], total: count || 0, page, limit });
}

export async function POST(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

  const body = await req.json().catch(() => ({}));
  if (!body.warehouse_id) return json({ error: 'Warehouse is required.' }, 400);
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return json({ error: 'At least one item is required.' }, 400);

  // Validate available stock before writing anything.
  for (const it of items) {
    const qty = Number(it.qty_issued) || 0;
    if (!qty || qty <= 0) return json({ error: 'Each item needs a positive quantity.' }, 400);
    const { data: existing } = await sb.from('inv_stock')
      .select('qty_on_hand, qty_reserved')
      .eq('warehouse_id', body.warehouse_id)
      .eq(it.product_id ? 'product_id' : 'material_id', it.product_id || it.material_id)
      .maybeSingle();
    const available = existing ? Number(existing.qty_on_hand) - Number(existing.qty_reserved) : 0;
    if (available < qty) return json({ error: `Insufficient available stock for one of the items (available: ${available}).` }, 400);
  }

  const { data: gi, error: giErr } = await sb.from('inv_goods_issues').insert({
    gi_number: body.gi_number || null,
    warehouse_id: body.warehouse_id,
    issue_date: body.issue_date || new Date().toISOString().slice(0, 10),
    issued_to: body.issued_to || null,
    reference_type: body.reference_type || null,
    reference_id: body.reference_id || null,
    notes: body.notes || null,
    issued_by: session.sub,
  }).select().single();
  if (giErr) return json({ error: 'Could not create goods issue.' }, 500);

  const itemRows = items.map(it => ({
    gi_id: gi.id,
    product_id: it.product_id || null,
    material_id: it.material_id || null,
    qty_issued: Number(it.qty_issued) || 0,
    unit_cost: Number(it.unit_cost) || 0,
  }));
  await sb.from('inv_goods_issue_items').insert(itemRows);

  for (const it of items) {
    const qty = Number(it.qty_issued) || 0;
    const filter = it.product_id
      ? { product_id: it.product_id, material_id: null }
      : { material_id: it.material_id, product_id: null };

    const { data: existing } = await sb.from('inv_stock')
      .select('id, qty_on_hand')
      .eq('warehouse_id', body.warehouse_id)
      .eq(it.product_id ? 'product_id' : 'material_id', it.product_id || it.material_id)
      .maybeSingle();

    const newQty = Math.max(0, (existing ? Number(existing.qty_on_hand) : 0) - qty);
    if (existing) {
      await sb.from('inv_stock').update({ qty_on_hand: newQty, updated_at: new Date().toISOString() }).eq('id', existing.id);
    }

    await sb.from('inv_stock_movements').insert({
      warehouse_id: body.warehouse_id,
      ...filter,
      movement_type: 'issue',
      qty,
      unit_cost: it.unit_cost || 0,
      reference: gi.gi_number || gi.id,
      reference_type: 'goods_issue',
      reference_id: gi.id,
      created_by: session.sub,
    });

    await syncItemQty(sb, { productId: it.product_id || null, materialId: it.material_id || null });
  }

  return json({ issue: gi }, 201);
}
