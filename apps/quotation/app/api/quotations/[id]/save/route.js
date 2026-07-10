'use strict';

/* Autosave endpoint: replaces the whole editable document in one call —
   header fields, product rows, and their cost lines — then recomputes
   every rollup and the quotation totals server-side (authoritative,
   same engine as the client). Draft-only (BR-5). Optimistic-concurrency
   guard via `version` (updated_at echo).                              */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { costLineTotal } = require('@/lib/costing');
const { rollupProduct, totalsOf } = require('@/lib/quotes');

const HEADER_FIELDS = ['customer_id', 'project_id', 'quote_date', 'valid_until', 'output_lang',
  'payment_terms', 'delivery_terms', 'customer_notes', 'internal_notes', 'terms_body_override',
  'discount_type', 'discount_value', 'vat_rate', 'follow_up_at', 'follow_up_note'];

const SECTIONS = ['material', 'hardware', 'labour', 'machine', 'expense', 'other'];

export async function PUT(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));

  const { data: current } = await sb.from('qt_quotations')
    .select('id, status, updated_at, discount_type, discount_value, vat_rate').eq('id', params.id).is('deleted_at', null).single();
  if (!current) return json({ error: 'Not found' }, 404);
  if (current.status !== 'draft') return json({ error: 'Quotation is not editable in status "' + current.status + '".' }, 409);
  if (body.version && body.version !== current.updated_at) {
    return json({ error: 'version_conflict' }, 409);
  }

  /* 1. Header */
  const header = {};
  for (const f of HEADER_FIELDS) if (body.header && body.header[f] !== undefined) header[f] = body.header[f] === '' ? null : body.header[f];

  /* 2. Products + lines: replace-all (simple + safe for editor-sized docs) */
  const products = Array.isArray(body.products) ? body.products : [];
  const cleanProducts = products.map((p, i) => {
    const lines = (Array.isArray(p.lines) ? p.lines : [])
      .filter(l => SECTIONS.includes(l.section))
      .map((l, j) => ({
        section: l.section, source_id: l.source_id || null, sort: j,
        name: l.name || null, spec_text: l.spec_text || null,
        unit: l.unit || null, qty: Number(l.qty) || 0, unit_cost: Number(l.unit_cost) || 0,
        waste_pct: Number(l.waste_pct) || 0,
        extra: l.extra && typeof l.extra === 'object' ? l.extra : {},
        line_total: 0,
      }));
    const base = {
      sort: i,
      catalogue_product_id: p.catalogue_product_id || null,
      name: p.name || null,
      name_en: p.name_en || null, name_ar: p.name_ar || null,
      description: p.description || null,
      description_en: p.description_en || null, description_ar: p.description_ar || null,
      unit: p.unit || 'nos', qty: Number(p.qty) || 1,
      unit_price: Number(p.unit_price) || 0,
      taxable: p.taxable !== false,
      line_discount: Number(p.line_discount) || 0,
      dimensions: p.dimensions && typeof p.dimensions === 'object' ? p.dimensions : {},
      base_dimensions: p.base_dimensions && typeof p.base_dimensions === 'object' ? p.base_dimensions : {},
      cost_params: p.cost_params,
      lines,
    };
    const roll = rollupProduct(base);
    const lineNet = Math.round((base.qty * base.unit_price - base.line_discount) * 100) / 100;
    return {
      ...base,
      line_total: lineNet,
      production_cost: roll.production_cost,
      overhead_pct: roll.overhead_pct, overhead_amount: roll.overhead_amount,
      risk_pct: roll.risk_pct, risk_amount: roll.risk_amount,
      total_cost: roll.total_cost,
      profit_mode: roll.profit_mode, profit_value: roll.profit_value,
      profit_amount: roll.profit_amount, margin_pct: roll.margin_pct,
    };
  });

  /* 3. Totals */
  const effHeader = { ...current, ...header };
  const totals = totalsOf(cleanProducts, effHeader);

  /* 4. Persist: header+totals, then replace products & lines. */
  const { error: hErr } = await sb.from('qt_quotations')
    .update({ ...header, ...totals, updated_by: session.sub, updated_at: new Date().toISOString() })
    .eq('id', params.id);
  if (hErr) return json({ error: hErr.message }, 500);

  const { error: dErr } = await sb.from('qt_quotation_products').delete().eq('quotation_id', params.id);
  if (dErr) return json({ error: dErr.message }, 500);

  for (const p of cleanProducts) {
    const { lines, cost_params, ...prodRow } = p;
    prodRow.quotation_id = params.id;
    const { data: np, error: pErr } = await sb.from('qt_quotation_products').insert(prodRow).select('id').single();
    if (pErr) return json({ error: pErr.message }, 500);
    if (lines.length) {
      const base = lines.reduce((s, l) => l.section !== 'expense' || !l.extra.pct_of_production ? s + costLineTotal(l) : s, 0);
      lines.forEach(l => { l.line_total = (l.section === 'expense' && l.extra.pct_of_production) ? costLineTotal(l, base) : costLineTotal(l); });
      const { error: lErr } = await sb.from('qt_qp_cost_lines').insert(lines.map(l => ({ ...l, quotation_product_id: np.id })));
      if (lErr) return json({ error: lErr.message }, 500);
    }
  }

  const { data: fresh } = await sb.from('qt_quotations').select('updated_at').eq('id', params.id).single();
  await audit(sb, 'qt_quotations', params.id, 'update', null, { autosave: true, products: cleanProducts.length, ...totals }, session.sub);
  return json({ totals, version: fresh ? fresh.updated_at : null });
}
