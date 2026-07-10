'use strict';

/* "Update Existing Product" (spec §9): writes a quotation product's
   current specifications back onto its source catalogue product —
   dimensions, cost model, cost params, description and selling price.
   Cost history is preserved in qt_catalogue_price_history.           */

const { getDb } = require('@/lib/db');
const { json, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { productCostSummary } = require('@/lib/costing');

export async function POST(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));

  const { data: product } = await sb.from('qt_catalogue_products')
    .select('id, standard_price, last_calculated_cost').eq('id', params.id).is('deleted_at', null).single();
  if (!product) return json({ error: 'Not found' }, 404);

  const lines = Array.isArray(body.lines) ? body.lines : [];
  const cp = body.cost_params || {};
  const summary = lines.length ? productCostSummary(lines, { ...cp, qty: 1 }) : null;

  const patch = {
    dimensions: body.dimensions && typeof body.dimensions === 'object' ? body.dimensions : {},
    description: body.description !== undefined ? body.description : undefined,
    standard_price: Number(body.unit_price) || (summary ? summary.unitPrice : product.standard_price),
    last_calculated_cost: summary ? summary.totalCost : product.last_calculated_cost,
    last_costed_at: new Date().toISOString(),
    cost_params: cp,
    updated_by: session.sub,
    updated_at: new Date().toISOString(),
  };
  Object.keys(patch).forEach(k => patch[k] === undefined && delete patch[k]);

  const { error: upErr } = await sb.from('qt_catalogue_products').update(patch).eq('id', params.id);
  if (upErr) return json({ error: upErr.message }, 500);

  await sb.from('qt_product_cost_lines').delete().eq('product_id', params.id);
  if (lines.length) {
    const { error: insErr } = await sb.from('qt_product_cost_lines').insert(lines.map((l, i) => ({
      product_id: params.id, section: l.section, source_id: l.source_id || null, sort: i,
      name: l.name || null, spec_text: l.spec_text || null,
      unit: l.unit || null, qty: Number(l.qty) || 0, unit_cost: Number(l.unit_cost) || 0,
      waste_pct: Number(l.waste_pct) || 0, extra: l.extra || {}, line_total: Number(l.line_total) || 0,
    })));
    if (insErr) return json({ error: insErr.message }, 500);
  }

  await sb.from('qt_catalogue_price_history').insert({
    product_id: params.id, price: patch.standard_price, cost: patch.last_calculated_cost, created_by: session.sub,
  });
  await audit(sb, 'qt_catalogue_products', params.id, 'update',
    { standard_price: product.standard_price, last_calculated_cost: product.last_calculated_cost },
    { updated_from_quotation: true, standard_price: patch.standard_price, cost: patch.last_calculated_cost },
    session.sub);
  return json({ ok: true, standard_price: patch.standard_price });
}
