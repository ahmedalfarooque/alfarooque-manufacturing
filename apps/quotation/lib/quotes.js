'use strict';

/* Server-side quotation helpers shared by the quotation API routes. */

const { productCostSummary, quotationSummary, r2 } = require('./costing');

async function getSetting(sb, key, fallback) {
  const { data } = await sb.from('qt_settings').select('value').eq('key', key).is('entity_id', null).maybeSingle();
  return (data && data.value) || fallback;
}

async function getThresholds(sb) {
  return getSetting(sb, 'approval_thresholds', { amount: 50000, min_margin_pct: 15, max_discount_pct: 10 });
}

async function getProfitDefaults(sb) {
  return getSetting(sb, 'profit_defaults', { overhead_pct: 10, risk_pct: 3, profit_pct: 25, rounding: 0 });
}

/* Recalculate one product's rollups from its cost lines + params.
   Cost lines describe ONE unit of the product; total_cost is extended
   by the quotation quantity. unit_price stays whatever the user set. */
function rollupProduct(p) {
  const qty = Number(p.qty) || 1;
  const lines = Array.isArray(p.lines) ? p.lines : [];
  if (!lines.length) {
    return {
      production_cost: null, overhead_pct: null, overhead_amount: null,
      risk_pct: null, risk_amount: null, total_cost: p.total_cost != null ? r2(Number(p.total_cost)) : null,
      profit_mode: null, profit_value: null, profit_amount: null, margin_pct: null,
      suggested_unit_price: null,
    };
  }
  const params = p.cost_params || {};
  const s = productCostSummary(lines, { ...params, qty: 1 });
  const extendedCost = r2(s.totalCost * qty);
  const lineNet = r2(qty * (Number(p.unit_price) || 0) - (Number(p.line_discount) || 0));
  const profit = r2(lineNet - extendedCost);
  return {
    production_cost: s.productionCost,
    overhead_pct: s.overheadPct, overhead_amount: s.overheadAmount,
    risk_pct: s.riskPct, risk_amount: s.riskAmount,
    total_cost: extendedCost,
    profit_mode: params.profitMode || 'pct',
    profit_value: Number(params.profitValue) || null,
    profit_amount: profit,
    margin_pct: lineNet > 0 ? r2(profit / lineNet * 100) : null,
    suggested_unit_price: s.unitPrice,
  };
}

/* Quotation-level totals from product rows (after rollup). */
function totalsOf(products, header) {
  const q = quotationSummary(
    products.map(p => ({
      qty: p.qty, unit_price: p.unit_price, taxable: p.taxable !== false,
      line_discount: p.line_discount || 0, total_cost: p.total_cost || 0,
    })),
    { discountType: header.discount_type || 'pct', discountValue: header.discount_value || 0, vatRate: header.vat_rate != null ? header.vat_rate : 15 },
  );
  return {
    subtotal: q.subtotal, discount_amount: q.discountAmount, net_total: q.netTotal,
    vat_amount: q.vatAmount, grand_total: q.grandTotal,
    total_cost: q.blendedCost, blended_margin_pct: q.blendedMarginPct,
  };
}

async function logEvent(sb, quotationId, event, detail, actorId) {
  try {
    await sb.from('qt_quotation_events').insert({ quotation_id: quotationId, event, detail: detail || {}, actor_id: actorId });
  } catch (_) {}
}

/* Deep-clone a quotation (products + cost lines). Returns new id.
   mode 'duplicate' → fresh number, revision 0, own root.
   mode 'revision'  → same root, revision+1, number ROOT-Rn, source superseded. */
async function cloneQuotation(sb, sourceId, session, mode) {
  const { data: src } = await sb.from('qt_quotations').select('*').eq('id', sourceId).is('deleted_at', null).single();
  if (!src) return { error: 'Not found' };

  const copy = { ...src };
  ['id', 'created_at', 'updated_at', 'deleted_at', 'public_token'].forEach(k => delete copy[k]);
  copy.status = 'draft';
  copy.created_by = session.sub; copy.updated_by = session.sub;
  copy.salesperson_id = copy.salesperson_id || session.sub;

  if (mode === 'revision') {
    const { data: maxRev } = await sb.from('qt_quotations')
      .select('revision').eq('root_id', src.root_id || src.id).order('revision', { ascending: false }).limit(1);
    const nextRev = ((maxRev && maxRev[0] && maxRev[0].revision) || 0) + 1;
    const baseNumber = String(src.quote_number).replace(/-R\d+$/, '');
    copy.quote_number = baseNumber + '-R' + nextRev;
    copy.revision = nextRev;
    copy.parent_id = src.id;
    copy.root_id = src.root_id || src.id;
  } else {
    const { data: num, error: numErr } = await sb.rpc('qt_next_quote_number', { p_entity: src.entity_id });
    if (numErr) return { error: numErr.message };
    copy.quote_number = num;
    copy.revision = 0;
    copy.parent_id = null;
    copy.root_id = null;   // set to own id after insert
  }

  const { data: created, error } = await sb.from('qt_quotations').insert(copy).select('id').single();
  if (error) return { error: error.message };
  if (mode !== 'revision') {
    await sb.from('qt_quotations').update({ root_id: created.id }).eq('id', created.id);
  }

  /* Copy products + lines. */
  const { data: prods } = await sb.from('qt_quotation_products').select('*').eq('quotation_id', sourceId).order('sort');
  for (const p of prods || []) {
    const pc = { ...p, quotation_id: created.id };
    const oldPid = p.id;
    delete pc.id; delete pc.created_at; delete pc.updated_at;
    const { data: np } = await sb.from('qt_quotation_products').insert(pc).select('id').single();
    if (!np) continue;
    const { data: cls } = await sb.from('qt_qp_cost_lines').select('*').eq('quotation_product_id', oldPid).order('sort');
    if (cls && cls.length) {
      await sb.from('qt_qp_cost_lines').insert(cls.map(l => {
        const c = { ...l, quotation_product_id: np.id };
        delete c.id; delete c.created_at; delete c.updated_at;
        return c;
      }));
    }
  }

  if (mode === 'revision') {
    await sb.from('qt_quotations').update({ status: 'superseded', updated_by: session.sub }).eq('id', sourceId);
    await logEvent(sb, sourceId, 'revised', { new_id: created.id }, session.sub);
  }
  await logEvent(sb, created.id, 'created', { mode, source: sourceId }, session.sub);
  return { id: created.id };
}

module.exports = { getSetting, getThresholds, getProfitDefaults, rollupProduct, totalsOf, logEvent, cloneQuotation };
