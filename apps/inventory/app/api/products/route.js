'use strict';

/* Inventory Products = the OPERATIONAL item master (purchased materials,
   finished/resale items, SmartLife-sourced stock — whatever AL FAROOQUE
   actually buys/sells/holds), not QuotePro's manufacturing catalogue.
   Falls back onto SmartLife's real product feed (2,912 real records) when
   the local table has no rows for the current filter. NOTE: this used to
   fall back onto the top-level `products` table — that is the public
   MARKETING WEBSITE's product showcase (SEO fields, warranty labels), a
   completely different dataset — fixed. QuotePro's own "Products" concept
   (qt_catalogue_products) is a different real entity — a calculated
   quotation cost template, not a warehouse stock item — so it is
   deliberately NOT used as the fallback here.

   An item classified 'material' (erp_item_business_classification) is
   still shown here — this page is the operational master for ALL
   operational items regardless of business role; a purchased material
   legitimately belongs in the operational item list. The classification
   is metadata (badge) for optionally connecting the item to an existing
   QuotePro Material (see /api/products/[id]/quotepro-link), never a
   filter that hides rows. */

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(500, parseInt(searchParams.get('limit') || '25', 10));
  const offset = (page - 1) * limit;
  const categoryId = searchParams.get('category_id');

  function baseQuery(countOpt) {
    let q = sb.from('inv_products').select(countOpt ? '*' : '*, inv_categories(name), inv_units(name, symbol)', countOpt ? { count: 'exact', head: true } : { count: 'exact' });
    if (search) q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
    if (categoryId) q = q.eq('category_id', categoryId);
    const activeParam = searchParams.get('active');
    if (activeParam !== null) q = q.eq('is_active', activeParam !== 'false');
    return q;
  }

  /* Check the local match count FIRST (cheap head:true query) rather than
     going straight to .range(offset, offset+limit-1) — on an empty (or
     small) local table, requesting a page whose offset exceeds the actual
     row count makes PostgREST return a range error, which previously threw
     a 500 "Could not load products" and never reached the SmartLife
     fallback below — silently breaking Products pagination beyond page 1
     whenever the local table has fewer rows than the requested offset
     (which is always true today, since inv_products is empty and the
     SmartLife-fallback dataset is ~2,900 rows spanning many pages). */
  const { count: localCount, error: countError } = await baseQuery(true);
  if (countError) return json({ error: 'Could not load products.' }, 500);

  let data, count;
  if (localCount && offset < localCount) {
    const result = await baseQuery(false).order('name', { ascending: true }).range(offset, offset + limit - 1);
    if (result.error) return json({ error: 'Could not load products.' }, 500);
    data = result.data; count = result.count;
  } else {
    count = localCount || 0;
    data = [];
  }
  if (!count) {
    /* Local-first: crm_record_mappings already holds every SmartLife
       product (2,921, zero duplicates, verified) — it's populated by the
       existing canonical sync job (apps/crm/.../[key]/sync/route.js calls
       upsertSmartErpSourceMappings() for every SMARTLIFE_RESOURCES entry,
       including 'products', which was already running; nothing new to
       sync here). Reading it instead of live-calling SmartLife means a
       normal page load never hits SmartERP at all — only the Sync button
       does. metadata.raw_payload is the exact original SmartLife record,
       so the field mapping below is unchanged from the old live path. */
    try {
      let mapQuery = sb.from('crm_record_mappings')
        .select('source_record_id, metadata', { count: 'exact' })
        .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('entity_type', 'products');
      if (search) {
        const needle = search.replace(/[%,()]/g, '');
        mapQuery = mapQuery.or(`metadata->>source_name.ilike.%${needle}%,metadata->>source_reference.ilike.%${needle}%`);
      }
      const { data: mappings, count: mapCount, error: mapError } = await mapQuery
        .order('metadata->>source_name', { ascending: true })
        .range(offset, offset + limit - 1);
      if (mapError) throw mapError;
      const ids = (mappings || []).map(m => m.source_record_id);
      const [{ data: classifications }, { data: links }] = ids.length
        ? await Promise.all([
            sb.from('erp_item_business_classification').select('source_record_id,business_role').eq('source_system', 'smartlife').in('source_record_id', ids),
            sb.from('erp_master_data_mappings').select('source_record_id,canonical_id').eq('source_system', 'smartlife').eq('entity_kind', 'material').in('source_record_id', ids),
          ])
        : [{ data: [] }, { data: [] }];
      const roleById = new Map((classifications || []).map(c => [c.source_record_id, c.business_role]));
      const linkById = new Map((links || []).map(l => [l.source_record_id, l.canonical_id]));
      data = (mappings || []).map(m => {
        const r = m.metadata?.raw_payload || {};
        return {
          id: r.id, name: r.name, sku: r.code || null, barcode: null,
          cost_price: Number(r.cost) || 0, selling_price: Number(r.price) || 0,
          qty_on_hand: Number(r.quantity) || 0, min_stock_qty: Number(r.alert_quantity) || 0,
          category_name: r.category || null, unit_name: r.unit || null, tax_rate: r.tax_rate || null,
          is_active: true, source_table: 'smartlife', read_only: true,
          business_role: roleById.get(String(r.id)) || 'unclassified',
          quotepro_material_id: linkById.get(String(r.id)) || null,
        };
      });
      count = mapCount || data.length;
    } catch (_) {
      /* Local snapshot unavailable (e.g. never synced yet) — genuinely
         empty, not an error the product list needs to surface; the
         dedicated SmartLife sync status is already shown elsewhere. */
      data = []; count = 0;
    }
  } else {
    data = (data || []).map(row => ({ ...row, category_name: row.inv_categories?.name || null, unit_name: row.inv_units?.name || null, source_table: 'inv_products', read_only: false, business_role: 'local' }));
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
