'use strict';

/* Local product master (inv_products) with a read-only fallback onto
   SmartLife's real product feed (2,912 real records) when the local table
   has no rows for the current filter. NOTE: this used to fall back onto
   the top-level `products` table — that is the public MARKETING WEBSITE's
   product showcase (SEO fields, warranty labels, images/videos), a
   completely different real-world dataset, not any ERP source. That was a
   real bug (silently showing e.g. "Premium Solid Hardwood Exterior Door"
   demo doors in the Inventory ERP) — fixed by falling back to the actual
   verified SmartLife product feed instead, same pattern as Materials'
   qt_materials fallback. QuotePro's own "Products" concept
   (qt_catalogue_products) is a different real entity — a calculated
   quotation cost template built from materials/labour/machines, not a
   warehouse stock item — so it is deliberately NOT used as the fallback
   here; Inventory's own inv_products schema already matches SmartLife's
   product shape (sku/barcode/cost/price/qty), which is the correct
   canonical reference for THIS module. */

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { parseCookies, COOKIE_NAME } = require('@/lib/auth');
const { SSO_COOKIE_NAME } = require('@/lib/sso');
const { readSmartLife } = require('@/lib/smartlife');

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

  let q = sb.from('inv_products')
    .select('*, inv_categories(name), inv_units(name, symbol)', { count: 'exact' });
  if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
  if (categoryId) q = q.eq('category_id', categoryId);
  const activeParam = searchParams.get('active');
  if (activeParam !== null) q = q.eq('is_active', activeParam !== 'false');

  let { data, count, error } = await q.order('name', { ascending: true }).range(offset, offset + limit - 1);
  if (error) return json({ error: 'Could not load products.' }, 500);
  if (!count) {
    try {
      const cookies = parseCookies(req.headers.get('cookie'));
      const result = await readSmartLife('products', {
        appToken: cookies[COOKIE_NAME], ssoToken: cookies[SSO_COOKIE_NAME],
      }, { search, offset: String(offset), limit: String(limit) });
      data = result.records.map(r => ({
        id: r.id, name: r.name, sku: r.code || null, barcode: null,
        cost_price: Number(r.cost) || 0, selling_price: Number(r.price) || 0,
        qty_on_hand: Number(r.quantity) || 0, min_stock_qty: Number(r.alert_quantity) || 0,
        category_name: r.category || null, unit_name: r.unit || null, tax_rate: r.tax_rate || null,
        is_active: true, source_table: 'smartlife', read_only: true,
      }));
      count = result.total || data.length;
    } catch (_) {
      /* SmartLife unavailable/permission-blocked — genuinely empty, not an
         error the product list needs to surface; the dedicated SmartLife
         status is already shown elsewhere in the app. */
      data = []; count = 0;
    }
  } else {
    data = (data || []).map(row => ({ ...row, category_name: row.inv_categories?.name || null, unit_name: row.inv_units?.name || null, source_table: 'inv_products', read_only: false }));
  }
  return json({ products: data, total: count || 0, page, limit });
}

export async function POST(req) {
  const { response, session } = await requireAction(req, 'add');
  if (response) return response;
  const sb = getDb();

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'Product name is required.' }, 400);

  const { data, error } = await sb.from('inv_products').insert({
    name,
    sku: body.sku || null,
    barcode: body.barcode || null,
    description: body.description || null,
    category_id: body.category_id || null,
    subcategory_id: body.subcategory_id || null,
    brand_id: body.brand_id || null,
    unit_id: body.unit_id || null,
    cost_price: body.cost_price || 0,
    selling_price: body.selling_price || 0,
    min_stock_qty: body.min_stock_qty || 0,
    max_stock_qty: body.max_stock_qty || null,
    qty_on_hand: 0,
    is_active: true,
  }).select().single();
  if (error) return json({ error: 'Could not add product.' }, 500);
  return json({ product: data }, 201);
}
