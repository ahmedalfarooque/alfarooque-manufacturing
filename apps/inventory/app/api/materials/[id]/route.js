'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, requireDelete } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  let { data, error } = await sb.from('inv_materials')
    .select('*, inv_categories(name), inv_units(name, symbol)')
    .eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load material.' }, 500);
  if (!data) {
    const legacy = await sb.from('qt_materials').select('*').eq('id', params.id).is('deleted_at', null).maybeSingle();
    if (legacy.error) return json({ error: 'Could not load material.' }, 500);
    if (legacy.data) data = { ...legacy.data, material_code: legacy.data.code, cost_price: legacy.data.latest_price || 0, qty_on_hand: 0, source_table: 'qt_materials' };
  }
  if (!data) return json({ error: 'Material not found.' }, 404);

  const { data: stock } = await sb.from('inv_stock')
    .select('qty_on_hand, qty_reserved, avg_cost, last_cost, inv_warehouses(name), inv_locations(name)')
    .eq('material_id', params.id);

  return json({ material: data, stock: stock || [] });
}

export async function PUT(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

  const body = await req.json().catch(() => ({}));
  const { error } = await sb.from('inv_materials').update({
    name: body.name,
    material_code: body.material_code || null,
    description: body.description || null,
    category_id: body.category_id || null,
    unit_id: body.unit_id || null,
    cost_price: body.cost_price || 0,
    min_stock_qty: body.min_stock_qty || 0,
    is_active: body.is_active !== false,
  }).eq('id', params.id);
  if (error) return json({ error: 'Could not update material.' }, 500);
  return json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { response, session } = await requireDelete(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'admin')) return json({ error: 'Admin access required.' }, 403);

  const { error } = await sb.from('inv_materials').update({ is_active: false }).eq('id', params.id);
  if (error) return json({ error: 'Could not deactivate material.' }, 500);
  return json({ ok: true });
}
