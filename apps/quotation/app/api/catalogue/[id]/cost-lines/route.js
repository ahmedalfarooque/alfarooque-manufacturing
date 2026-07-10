'use strict';

/* Replaces the product's cost-model lines and recalculates the rollup
   server-side with the same pure engine the client uses (lib/costing) —
   the server result is authoritative. Body:
   { lines: [...], params: {overheadPct,riskPct,profitMode,profitValue,
     sellingPrice,rounding}, setStandardPrice?: boolean }               */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { costLineTotal, productCostSummary } = require('@/lib/costing');

const SECTIONS = ['material', 'hardware', 'labour', 'machine', 'expense', 'other'];

export async function PUT(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  const lines = Array.isArray(body.lines) ? body.lines : [];
  const costParams = body.params || {};

  const { data: product } = await sb.from('qt_catalogue_products')
    .select('id, standard_price, cost_params').eq('id', params.id).is('deleted_at', null).single();
  if (!product) return json({ error: 'Not found' }, 404);

  /* Sanitise + snapshot-shape each line. */
  const clean = lines
    .filter(l => SECTIONS.includes(l.section))
    .map((l, i) => ({
      product_id: params.id,
      section: l.section,
      source_id: l.source_id || null,
      sort: i,
      name: l.name || null,

      spec_text: l.spec_text || null,
      unit: l.unit || null,
      qty: Number(l.qty) || 0,
      unit_cost: Number(l.unit_cost) || 0,
      waste_pct: Number(l.waste_pct) || 0,
      extra: l.extra && typeof l.extra === 'object' ? l.extra : {},
      line_total: 0,
    }));

  const summary = productCostSummary(clean, { ...costParams, qty: 1 });
  const directBase = summary.productionCost;
  clean.forEach(l => {
    l.line_total = (l.section === 'expense' && l.extra.pct_of_production)
      ? costLineTotal(l, directBase) : costLineTotal(l);
  });

  /* Replace lines transactionally enough for a single-user edit flow. */
  const { error: delErr } = await sb.from('qt_product_cost_lines').delete().eq('product_id', params.id);
  if (delErr) return json({ error: delErr.message }, 500);
  if (clean.length) {
    const { error: insErr } = await sb.from('qt_product_cost_lines').insert(clean);
    if (insErr) return json({ error: insErr.message }, 500);
  }

  const patch = {
    last_calculated_cost: summary.totalCost,
    last_costed_at: new Date().toISOString(),
    cost_params: {
      overheadPct: Number(costParams.overheadPct) || 0,
      riskPct: Number(costParams.riskPct) || 0,
      profitMode: costParams.profitMode || 'pct',
      profitValue: Number(costParams.profitValue) || 0,
      sellingPrice: Number(costParams.sellingPrice) || 0,
      rounding: Number(costParams.rounding) || 0,
    },
    updated_by: session.sub,
    updated_at: new Date().toISOString(),
  };
  if (body.setStandardPrice) {
    patch.standard_price = summary.unitPrice;
    await sb.from('qt_catalogue_price_history').insert({
      product_id: params.id, price: summary.unitPrice, cost: summary.totalCost, created_by: session.sub,
    });
  }
  const { error: upErr } = await sb.from('qt_catalogue_products').update(patch).eq('id', params.id);
  if (upErr) return json({ error: upErr.message }, 500);

  await audit(sb, 'qt_product_cost_lines', params.id, 'update',
    { standard_price: product.standard_price }, { lines: clean.length, summary }, session.sub);
  return json({ summary, lines: clean.length });
}
