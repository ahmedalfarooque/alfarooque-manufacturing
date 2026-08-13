'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, requireDelete , requireAction } = require('@/lib/http');

async function categoryName(sb, table, categoryId) {
  if (!categoryId) return null;
  const { data } = await sb.from(table).select('name').eq('id', categoryId).maybeSingle();
  return data?.name || null;
}

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  let { data, error } = await sb.from('inv_materials')
    .select('*, inv_units(name, symbol)')
    .eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load material.' }, 500);
  let readOnly = false;
  if (!data) {
    const legacy = await sb.from('qt_materials').select('*').eq('id', params.id).is('deleted_at', null).maybeSingle();
    if (legacy.error) return json({ error: 'Could not load material.' }, 500);
    if (legacy.data) {
      data = { ...legacy.data, name: legacy.data.name_en || legacy.data.name_ar, material_code: legacy.data.code, cost_price: legacy.data.latest_price || 0, qty_on_hand: 0, source_table: 'qt_materials' };
      readOnly = true;
    }
  }
  if (!data) return json({ error: 'Material not found.' }, 404);
  data.category_name = await categoryName(sb, readOnly ? 'qt_material_categories' : 'inv_categories', data.category_id);
  data.read_only = readOnly;

  const { data: stock } = await sb.from('inv_stock')
    .select('qty_on_hand, qty_reserved, avg_cost, last_cost, inv_warehouses(name), inv_locations(name)')
    .eq('material_id', params.id);

  return json({ material: data, stock: stock || [] });
}

/* qt_materials-sourced rows (readOnly=true) are never writable from here —
   Inventory's own inv_materials table has no row at that id, so a naive
   .update().eq('id', params.id) would silently match zero rows and
   report success. Check existence first and reject explicitly instead. */
async function assertLocalAndWritable(sb, id) {
  const { data } = await sb.from('inv_materials').select('id').eq('id', id).maybeSingle();
  if (!data) {
    const { data: legacy } = await sb.from('qt_materials').select('id').eq('id', id).is('deleted_at', null).maybeSingle();
    if (legacy) return { blocked: true };
    return { blocked: false, notFound: true };
  }
  return { blocked: false };
}

export async function PUT(req, { params }) {
  const { response, session } = await requireAction(req, 'edit');
  if (response) return response;
  const sb = getDb();

  const check = await assertLocalAndWritable(sb, params.id);
  if (check.blocked) return json({ error: 'This material is synced from QuotePro and is read-only here. Edit it in QuotePro.' }, 403);
  if (check.notFound) return json({ error: 'Material not found.' }, 404);

  const body = await req.json().catch(() => ({}));
  const { error } = await sb.from('inv_materials').update({
    name: body.name,
    name_ar: body.name_ar || null,
    material_code: body.material_code || null,
    barcode: body.barcode || null,
    brand: body.brand || null,
    description: body.description || null,
    category_id: body.category_id || null,
    unit_id: body.unit_id || null,
    cost_price: body.cost_price || 0,
    default_waste_pct: body.default_waste_pct || null,
    height_value: body.height_value || null, height_unit: body.height_unit || null,
    width_value: body.width_value || null, width_unit: body.width_unit || null,
    length_value: body.length_value || null, length_unit: body.length_unit || null,
    thickness_value: body.thickness_value || null, thickness_unit: body.thickness_unit || null,
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

  const check = await assertLocalAndWritable(sb, params.id);
  if (check.blocked) return json({ error: 'This material is synced from QuotePro and is read-only here. Edit it in QuotePro.' }, 403);
  if (check.notFound) return json({ error: 'Material not found.' }, 404);

  const { error } = await sb.from('inv_materials').update({ is_active: false }).eq('id', params.id);
  if (error) return json({ error: 'Could not deactivate material.' }, 500);
  return json({ ok: true });
}
