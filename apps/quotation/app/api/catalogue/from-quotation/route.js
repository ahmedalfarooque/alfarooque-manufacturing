'use strict';

/* "Save as New Product" (spec §10): creates a catalogue product from a
   quotation product's current specifications — new never-reused code,
   dimensions, description, cost model and selling price. The original
   catalogue product is untouched. Body:
   { source_product_id?, name_en, name_ar, description_en, description_ar,
     unit, dimensions, unit_price, cost_params, lines: [...] }           */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { productCostSummary } = require('@/lib/costing');

export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  if (!body.name) return json({ error: 'Product name required.' }, 400);

  let src = null;
  if (body.source_product_id) {
    const { data } = await sb.from('qt_catalogue_products')
      .select('category, sub_category, unit, image_path, images, tags').eq('id', body.source_product_id).maybeSingle();
    src = data;
  }

  const { data: code } = await sb.rpc('qt_next_product_code');
  const params = body.cost_params || {};
  const lines = Array.isArray(body.lines) ? body.lines : [];
  const summary = lines.length ? productCostSummary(lines, { ...params, qty: 1 }) : null;

  const row = {
    code: code || ('P-' + Date.now()),
    name: body.name,
    category: (src && src.category) || body.category || 'OTHER',
    sub_category: (src && src.sub_category) || body.sub_category || null,
    description: body.description || null,
    unit: body.unit || (src && src.unit) || 'nos',
    dimensions: body.dimensions && typeof body.dimensions === 'object' ? body.dimensions : {},
    standard_price: Number(body.unit_price) || (summary ? summary.unitPrice : 0),
    last_calculated_cost: summary ? summary.totalCost : null,
    last_costed_at: summary ? new Date().toISOString() : null,
    cost_params: params,
    image_path: (src && src.image_path) || null,
    images: (src && src.images) || [],
    tags: (src && src.tags) || [],
    status: 'active',
    created_by: session.sub, updated_by: session.sub,
  };

  const { data: created, error } = await sb.from('qt_catalogue_products').insert(row).select('id, code').single();
  if (error) return json({ error: error.message }, 500);

  if (lines.length) {
    await sb.from('qt_product_cost_lines').insert(lines.map((l, i) => ({
      product_id: created.id, section: l.section, source_id: l.source_id || null, sort: i,
      name: l.name || null, spec_text: l.spec_text || null,
      unit: l.unit || null, qty: Number(l.qty) || 0, unit_cost: Number(l.unit_cost) || 0,
      waste_pct: Number(l.waste_pct) || 0, extra: l.extra || {}, line_total: Number(l.line_total) || 0,
    })));
  }
  await sb.from('qt_catalogue_price_history').insert({
    product_id: created.id, price: row.standard_price, cost: row.last_calculated_cost, created_by: session.sub,
  });
  await audit(sb, 'qt_catalogue_products', created.id, 'insert',
    null, { from_quotation: true, source: body.source_product_id || null }, session.sub);
  return json({ id: created.id, code: created.code }, 201);
}
