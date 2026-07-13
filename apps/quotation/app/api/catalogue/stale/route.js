'use strict';

/* Stale-cost detection (spec §13–16): finds catalogue products whose
   snapshot cost lines no longer match the CURRENT master prices
   (materials/hardware latest_price, labour rates, machine hourly cost,
   expense defaults). Selling prices are never touched automatically —
   the UI shows "N products need recalculation" with a button.

   GET  → { count, products: [{id, code, name, changes}] }
   POST → { ids?: [uuid] } | { all: true }  — applies fresh master
          prices to the affected lines, recomputes each product's cost,
          appends qt_catalogue_price_history (cost history, spec §17)
          and leaves standard_price unchanged.                        */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { productCostSummary, costLineTotal, r2 } = require('@/lib/costing');

export const runtime = 'nodejs';
export const maxDuration = 300;

function labourRate(role, unit) {
  if (unit === 'hour') return Number(role.hourly_rate);
  if (unit === 'month') return Number(role.monthly_rate);
  return Number(role.daily_rate);
}

/* Builds { staleByProduct: Map(productId → [{lineId, section, old, new}]) } */
async function findStale(sb) {
  const { data: lines } = await sb.from('qt_product_cost_lines')
    .select('id, product_id, section, source_id, unit, unit_cost, extra')
    .not('source_id', 'is', null).limit(50000);
  if (!lines || !lines.length) return new Map();

  const ids = (secs) => [...new Set(lines.filter(l => secs.includes(l.section)).map(l => l.source_id))];
  const [mats, labs, machs, exps] = await Promise.all([
    ids(['material', 'hardware']).length ? sb.from('qt_materials').select('id, latest_price, unit').in('id', ids(['material', 'hardware'])) : { data: [] },
    ids(['labour']).length ? sb.from('qt_labour_roles').select('id, hourly_rate, daily_rate, monthly_rate').in('id', ids(['labour'])) : { data: [] },
    ids(['machine']).length ? sb.from('qt_machines').select('id, hourly_cost').in('id', ids(['machine'])) : { data: [] },
    ids(['expense']).length ? sb.from('qt_expense_templates').select('id, default_amount, unit').in('id', ids(['expense'])) : { data: [] },
  ]);
  const matMap = new Map((mats.data || []).map(m => [m.id, m]));
  const labMap = new Map((labs.data || []).map(m => [m.id, m]));
  const machMap = new Map((machs.data || []).map(m => [m.id, m]));
  const expMap = new Map((exps.data || []).map(m => [m.id, m]));

  const stale = new Map();
  for (const l of lines) {
    /* rate_locked lines keep their entered rate forever (e.g. bulk-imported
       cost models whose rates are unit-converted / excl-VAT by design). */
    if (l.extra && l.extra.rate_locked) continue;
    let next = null;
    if (l.section === 'material' || l.section === 'hardware') {
      const m = matMap.get(l.source_id);
      /* Lines costed in a different unit than the master (e.g. per-m² line
         vs per-piece master price) are not comparable — never refresh. */
      if (m && m.unit === l.unit && r2(Number(m.latest_price)) !== r2(Number(l.unit_cost))) next = Number(m.latest_price);
    } else if (l.section === 'labour') {
      const rle = labMap.get(l.source_id);
      if (rle) {
        const rate = labourRate(rle, l.unit);
        if (r2(rate) !== r2(Number(l.unit_cost))) next = rate;
      }
    } else if (l.section === 'machine') {
      const m = machMap.get(l.source_id);
      if (m && r2(Number(m.hourly_cost)) !== r2(Number(l.unit_cost))) next = Number(m.hourly_cost);
    } else if (l.section === 'expense') {
      const e = expMap.get(l.source_id);
      if (e && e.unit !== 'pct_production' && r2(Number(e.default_amount)) !== r2(Number(l.unit_cost))) next = Number(e.default_amount);
    }
    if (next !== null) {
      if (!stale.has(l.product_id)) stale.set(l.product_id, []);
      stale.get(l.product_id).push({ lineId: l.id, old: Number(l.unit_cost), next });
    }
  }
  return stale;
}

export async function GET(req) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const sb = getDb();
  const stale = await findStale(sb);
  const productIds = [...stale.keys()];
  let products = [];
  if (productIds.length) {
    const { data } = await sb.from('qt_catalogue_products')
      .select('id, code, name').in('id', productIds).is('deleted_at', null);
    products = (data || []).map(p => ({ ...p, changes: (stale.get(p.id) || []).length }));
  }
  return json({ count: products.length, products });
}

export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  const stale = await findStale(sb);
  let targetIds = [...stale.keys()];
  if (!body.all && Array.isArray(body.ids)) targetIds = targetIds.filter(id => body.ids.includes(id));

  let recalculated = 0;
  for (const productId of targetIds) {
    /* 1. Refresh stale line unit costs. */
    for (const c of stale.get(productId) || []) {
      await sb.from('qt_product_cost_lines').update({ unit_cost: c.next }).eq('id', c.lineId);
    }
    /* 2. Recompute the product's cost with the shared engine. */
    const { data: product } = await sb.from('qt_catalogue_products')
      .select('id, cost_params, standard_price, last_calculated_cost').eq('id', productId).is('deleted_at', null).single();
    if (!product) continue;
    const { data: lines } = await sb.from('qt_product_cost_lines').select('*').eq('product_id', productId).order('sort');
    const summary = productCostSummary(lines || [], { ...(product.cost_params || {}), qty: 1 });
    const base = summary.productionCost;
    for (const l of lines || []) {
      const total = (l.section === 'expense' && l.extra && l.extra.pct_of_production)
        ? costLineTotal(l, base) : costLineTotal(l);
      if (r2(total) !== r2(Number(l.line_total))) {
        await sb.from('qt_product_cost_lines').update({ line_total: total }).eq('id', l.id);
      }
    }
    /* 3. Update cost (NOT the selling price) + append cost history. */
    await sb.from('qt_catalogue_products').update({
      last_calculated_cost: summary.totalCost,
      last_costed_at: new Date().toISOString(),
      updated_by: session.sub, updated_at: new Date().toISOString(),
    }).eq('id', productId);
    await sb.from('qt_catalogue_price_history').insert({
      product_id: productId, price: product.standard_price, cost: summary.totalCost, created_by: session.sub,
    });
    recalculated++;
  }

  await audit(sb, 'qt_catalogue_products', null, 'update', null, { bulk_recalculate: recalculated }, session.sub);
  return json({ recalculated });
}
