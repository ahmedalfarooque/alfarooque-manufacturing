'use strict';

/* GET /api/inventory-search?q=<term>&type=all|products|materials
   Queries inv_* tables directly (same Supabase project) so purchase-request
   forms can link to a specific inventory item. */

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { parseCookies, COOKIE_NAME } = require('@/lib/auth');
const { SSO_COOKIE_NAME } = require('@/lib/sso');
const { readSmartLife } = require('@/lib/smartlife');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const type = url.searchParams.get('type') || 'all';

  if (q.length < 2) return json({ products: [], materials: [] });

  const sb = getDb();
  const pattern = `%${q}%`;
  const results = { products: [], materials: [] };

  if (type === 'all' || type === 'products') {
    const { data } = await sb.from('inv_products')
      .select('id, sku, name, name_ar, qty_on_hand, cost_price, selling_price')
      .eq('is_active', true)
      .or(`name.ilike.${pattern},sku.ilike.${pattern},barcode.ilike.${pattern}`)
      .order('name')
      .limit(10);
    results.products = data || [];
    /* No local match — fall back to the real live SmartLife product feed
       (same pattern as apps/accounting/app/api/inventory-search) so a
       genuinely-existing purchased product is actually findable instead of
       silently invisible, which would otherwise push the user straight to
       "Add New Item" and create a duplicate of something that already
       exists in SmartLife. Read-only/not linkable via inv_product_id (no
       local FK target) — the picker's isLinkable() gate covers it. */
    if (!results.products.length) {
      try {
        const cookies = parseCookies(req.headers.get('cookie'));
        const result = await readSmartLife('products', {
          appToken: cookies[COOKIE_NAME], ssoToken: cookies[SSO_COOKIE_NAME],
        }, { search: q, limit: '10' });
        results.products = (result.records || []).map(r => ({
          id: r.id, name: r.name, sku: r.code || null,
          cost_price: Number(r.cost) || 0, selling_price: Number(r.price) || 0,
          qty_on_hand: Number(r.quantity) || 0, source_table: 'smartlife', read_only: true,
        }));
      } catch (_) { /* SmartLife unavailable — genuinely no match, not an error to surface here */ }
    }
  }

  if (type === 'all' || type === 'materials') {
    const { data } = await sb.from('inv_materials')
      .select('id, material_code, name, name_ar, qty_on_hand, cost_price')
      .eq('is_active', true)
      .or(`name.ilike.${pattern},material_code.ilike.${pattern}`)
      .order('name')
      .limit(10);
    results.materials = data || [];
    /* QuotePro's qt_materials is the de facto canonical material dataset
       (~1,140 real rows) — same fallback apps/accounting already has. */
    if (!results.materials.length) {
      const { data: legacy } = await sb.from('qt_materials')
        .select('id, code, name, name_ar, latest_price').is('deleted_at', null)
        .or(`name.ilike.${pattern},code.ilike.${pattern}`).order('name').limit(10);
      results.materials = (legacy || []).map(row => ({ ...row, material_code: row.code, qty_on_hand: 0, cost_price: row.latest_price || 0, source_table: 'qt_materials' }));
    }
  }

  return json(results);
}

/* POST { kind: 'product'|'material', name, unit, cost_price }
   Creates a new row directly in the SAME canonical operational item table
   (inv_products / inv_materials) that Inventory's own /api/products and
   /api/materials POST routes write to — not a Purchase-Request-only table,
   never a QuotePro Material. Mirrors Inventory's insert shape exactly. */
export async function POST(req) {
  const { response } = await requireAction(req, 'add');
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const kind = body.kind === 'material' ? 'material' : 'product';
  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'Item name is required.' }, 400);

  const sb = getDb();
  if (kind === 'material') {
    const { data, error } = await sb.from('inv_materials').insert({
      name, name_ar: body.name_ar || null, material_code: body.material_code || null,
      unit_id: body.unit_id || null, cost_price: body.cost_price || 0, qty_on_hand: 0, is_active: true,
    }).select().single();
    if (error) return json({ error: 'Could not add material.' }, 500);
    return json({ material: { ...data, source_table: 'inv_materials', read_only: false } }, 201);
  }
  const { data, error } = await sb.from('inv_products').insert({
    name, sku: body.sku || null, unit_id: body.unit_id || null,
    cost_price: body.cost_price || 0, selling_price: body.selling_price || 0, qty_on_hand: 0, is_active: true,
  }).select().single();
  if (error) return json({ error: 'Could not add product.' }, 500);
  return json({ product: { ...data, source_table: 'inv_products', read_only: false } }, 201);
}
