'use strict';

/* Local material master (inv_materials) with a read-only fallback onto
   QuotePro's real, actively-used qt_materials when the local table has no
   rows for the current filter — QuotePro is the canonical/reference
   material dataset (1,141 real records with version-controlled pricing);
   Inventory's own table starts empty rather than duplicating it. Every
   row is tagged `source_table` + `read_only` so the UI can gate Edit/
   Delete: local rows are fully editable here, qt_materials-sourced rows
   are view/print/PDF-only (editing them belongs in QuotePro — see the
   [id] route for the write-side of this same rule). */

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');

async function attachCategoryNames(sb, rows) {
  const localIds = [...new Set(rows.filter(r => r.source_table !== 'qt_materials' && r.category_id).map(r => r.category_id))];
  const legacyIds = [...new Set(rows.filter(r => r.source_table === 'qt_materials' && r.category_id).map(r => r.category_id))];
  const [localCats, legacyCats] = await Promise.all([
    localIds.length ? sb.from('inv_categories').select('id,name').in('id', localIds) : { data: [] },
    legacyIds.length ? sb.from('qt_material_categories').select('id,name').in('id', legacyIds) : { data: [] },
  ]);
  const localMap = new Map((localCats.data || []).map(c => [c.id, c.name]));
  const legacyMap = new Map((legacyCats.data || []).map(c => [c.id, c.name]));
  return rows.map(r => ({ ...r, category_name: r.source_table === 'qt_materials' ? (legacyMap.get(r.category_id) || null) : (localMap.get(r.category_id) || null) }));
}

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
  const offset = (page - 1) * limit;
  const categoryId = searchParams.get('category_id');

  let q = sb.from('inv_materials')
    .select('*, inv_units(name, symbol)', { count: 'exact' });
  if (search) q = q.or(`name.ilike.%${search}%,material_code.ilike.%${search}%,barcode.ilike.%${search}%`);
  if (categoryId) q = q.eq('category_id', categoryId);
  const activeParam = searchParams.get('active');
  if (activeParam !== null) q = q.eq('is_active', activeParam !== 'false');

  let { data, count, error } = await q.order('name', { ascending: true }).range(offset, offset + limit - 1);
  if (error) return json({ error: 'Could not load materials.' }, 500);
  if (!count) {
    /* No local category/unit filter maps onto qt_materials' own category/
       unit space, so those filters simply don't narrow the fallback view
       — search still applies. This mirrors the existing pre-fallback
       behavior, not a new limitation introduced here. */
    let legacy = sb.from('qt_materials').select('*').is('deleted_at', null);
    if (search) legacy = legacy.or(`name_en.ilike.%${search}%,name_ar.ilike.%${search}%,code.ilike.%${search}%,barcode.ilike.%${search}%`);
    const legacyRes = await legacy.order('name_en').range(offset, offset + limit - 1);
    const { count: legacyCount } = await sb.from('qt_materials').select('id', { count: 'exact', head: true }).is('deleted_at', null);
    if (!legacyRes.error) {
      data = (legacyRes.data || []).map(row => ({
        ...row,
        name: row.name_en || row.name_ar,
        material_code: row.code,
        cost_price: row.latest_price || 0,
        is_active: row.status !== 'inactive',
        qty_on_hand: 0,
        source_table: 'qt_materials',
        read_only: true,
      }));
      count = legacyCount || 0;
    }
  } else {
    data = (data || []).map(row => ({ ...row, source_table: 'inv_materials', read_only: false }));
  }
  data = await attachCategoryNames(sb, data || []);
  return json({ materials: data, total: count || 0, page, limit });
}

export async function POST(req) {
  const { response, session } = await requireAction(req, 'add');
  if (response) return response;
  const sb = getDb();

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'Material name is required.' }, 400);

  const { data, error } = await sb.from('inv_materials').insert({
    name,
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
    qty_on_hand: 0,
    is_active: true,
  }).select().single();
  if (error) return json({ error: 'Could not add material.' }, 500);
  return json({ material: data }, 201);
}
