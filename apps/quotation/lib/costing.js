'use strict';

/* ═══════════════════════════════════════════════════════════════════
   Pure costing engine — the ONLY place costing formulas live.
   Implements §9 of docs/Quotation System Master Specification.md.
   Used client-side for instant totals and server-side for the
   authoritative recalculation before save. No imports, no I/O.
   All money rounded to 2 dp at line level, then summed (halala-safe).
   ═══════════════════════════════════════════════════════════════════ */

function r2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }
function num(n, d = 0) { const v = Number(n); return Number.isFinite(v) ? v : d; }

/* ── Cost lines ─────────────────────────────────────────────────────
   line = { section, qty, unit_cost, waste_pct, extra:{ setup_cost, pct_of_production } }
   sections: material | hardware | labour | machine | expense | other  */
function costLineTotal(line, productionBaseForPct = 0) {
  const qty = num(line.qty);
  const unitCost = num(line.unit_cost);
  const waste = num(line.waste_pct);
  const extra = line.extra || {};
  switch (line.section) {
    case 'material':
    case 'hardware':
      return r2(qty * unitCost * (1 + waste / 100));
    case 'labour':
      return r2(qty * unitCost);
    case 'machine':
      return r2(qty * unitCost + num(extra.setup_cost));
    case 'expense':
      if (extra.pct_of_production) return r2(productionBaseForPct * num(extra.pct_of_production) / 100);
      return r2(qty ? qty * unitCost : unitCost);
    case 'other':
      return r2(qty ? qty * unitCost : unitCost);
    default:
      return 0;
  }
}

/* ── Product cost summary (spec §9.1) ───────────────────────────────
   opts = { overheadPct, riskPct, profitMode:'pct'|'fixed'|'selling',
            profitValue, sellingPrice, qty, rounding:0|1|5|10 }        */
function roundTo(value, step) {
  if (!step) return r2(value);
  return r2(Math.round(value / step) * step);
}

function productCostSummary(lines, opts = {}) {
  const qty = Math.max(num(opts.qty, 1), 0.001);
  const sums = { material: 0, hardware: 0, labour: 0, machine: 0, expense: 0, other: 0 };
  const pctExpenses = [];

  for (const line of lines || []) {
    if (line.section === 'expense' && line.extra && line.extra.pct_of_production) {
      pctExpenses.push(line);
      continue;
    }
    sums[line.section] = r2((sums[line.section] || 0) + costLineTotal(line));
  }

  const directBase = r2(sums.material + sums.hardware + sums.labour + sums.machine + sums.expense + sums.other);
  let pctExpenseTotal = 0;
  for (const line of pctExpenses) pctExpenseTotal = r2(pctExpenseTotal + costLineTotal(line, directBase));
  sums.expense = r2(sums.expense + pctExpenseTotal);

  const productionCost = r2(directBase + pctExpenseTotal);
  const overheadPct = num(opts.overheadPct);
  const riskPct = num(opts.riskPct);
  const overheadAmount = r2(productionCost * overheadPct / 100);
  const riskAmount = r2((productionCost + overheadAmount) * riskPct / 100);
  const totalCost = r2(productionCost + overheadAmount + riskAmount);

  let profitAmount, sellingTotal;
  const mode = opts.profitMode || 'pct';
  if (mode === 'selling') {
    sellingTotal = r2(num(opts.sellingPrice) * qty);
    profitAmount = r2(sellingTotal - totalCost);
  } else if (mode === 'fixed') {
    profitAmount = r2(num(opts.profitValue));
    sellingTotal = roundTo(totalCost + profitAmount, num(opts.rounding));
    profitAmount = r2(sellingTotal - totalCost);
  } else {
    profitAmount = r2(totalCost * num(opts.profitValue) / 100);
    sellingTotal = roundTo(totalCost + profitAmount, num(opts.rounding));
    profitAmount = r2(sellingTotal - totalCost);
  }

  const unitPrice = r2(sellingTotal / qty);
  const profitPct = totalCost > 0 ? r2(profitAmount / totalCost * 100) : 0;   // markup
  const marginPct = sellingTotal > 0 ? r2(profitAmount / sellingTotal * 100) : 0;

  return {
    sums, productionCost, overheadPct, overheadAmount, riskPct, riskAmount,
    totalCost, profitAmount, profitPct, marginPct, sellingTotal, unitPrice, qty,
  };
}

/* ── Quotation summary (spec §9.2) ──────────────────────────────────
   products = [{ qty, unit_price, taxable, line_discount, total_cost }]
   opts = { discountType:'pct'|'amount', discountValue, vatRate }      */
function quotationSummary(products, opts = {}) {
  let subtotal = 0, taxableBase = 0, blendedCost = 0;
  const lines = (products || []).map(p => {
    const amount = r2(num(p.qty) * num(p.unit_price) - num(p.line_discount));
    subtotal = r2(subtotal + amount);
    if (p.taxable !== false) taxableBase = r2(taxableBase + amount);
    blendedCost = r2(blendedCost + num(p.total_cost));
    return { ...p, line_total: amount };
  });

  const discountAmount = opts.discountType === 'amount'
    ? r2(num(opts.discountValue))
    : r2(subtotal * num(opts.discountValue) / 100);
  const netTotal = r2(subtotal - discountAmount);

  /* Discount applies pro-rata across lines, so VAT is charged only on
     the taxable share of the net total. */
  const taxableNet = subtotal > 0 ? r2(taxableBase / subtotal * netTotal) : 0;
  const vatRate = num(opts.vatRate, 15);
  const vatAmount = r2(taxableNet * vatRate / 100);
  const grandTotal = r2(netTotal + vatAmount);

  const profit = r2(netTotal - blendedCost);
  const blendedMarginPct = netTotal > 0 ? r2(profit / netTotal * 100) : 0;

  return { lines, subtotal, discountAmount, netTotal, vatRate, vatAmount, grandTotal, blendedCost, profit, blendedMarginPct };
}

/* ── Dynamic size pricing (spec §8) ─────────────────────────────────
   Scale factor between two dimension sets: volume ratio when both have
   (or can derive) a volume, else area ratio (or length×width in mm),
   else length ratio, else 1. All keys optional.                      */
function dimArea(d) {
  if (!d) return 0;
  if (Number(d.area) > 0) return Number(d.area);
  if (Number(d.length) > 0 && Number(d.width) > 0) return Number(d.length) * Number(d.width) / 1e6; // mm² → m²
  return 0;
}
function dimVolume(d) {
  if (!d) return 0;
  if (Number(d.volume) > 0) return Number(d.volume);
  const a = dimArea(d);
  const th = Number(d.thickness) || Number(d.height) || 0;
  if (a > 0 && th > 0) return a * th / 1000; // m² × mm → m³
  return 0;
}
function dimPerimeter(d) {
  if (!d) return 0;
  const L = Number(d.length) || 0, W = Number(d.width) || 0;
  if (L > 0 && W > 0) return 2 * (L + W);                 // mm
  return L > 0 ? L : 0;
}
function ratio(b, n) { return (b > 0 && n > 0) ? Math.round(n / b * 10000) / 10000 : 1; }

function scaleFactor(baseDims, newDims) {
  const bv = dimVolume(baseDims), nv = dimVolume(newDims);
  if (bv > 0 && nv > 0) return ratio(bv, nv);
  const ba = dimArea(baseDims), na = dimArea(newDims);
  if (ba > 0 && na > 0) return ratio(ba, na);
  return ratio(Number(baseDims && baseDims.length) || 0, Number(newDims && newDims.length) || 0);
}

/* ── Per-line scaling formula (spec §8) ─────────────────────────────
   Each line may declare its basis in extra.scale_basis:
     'auto'      volume → area → length ratio (default for materials,
                 labour, machines, size-dependent expenses)
     'fixed'     never scales (default for HARDWARE — hinges, locks…)
     'area'      qty = base qty × (new area / base area)      — sheets, paint
     'perimeter' qty = base qty × perimeter ratio             — edge band
     'length'    qty = base qty × length ratio                — hardwood, profiles
     'volume'    qty = base qty × volume ratio                — solid timber
   Lines flagged extra.manual (user override) are never rescaled until
   the override is reset. Waste % and unit costs are untouched (BR-8). */
function lineFactor(l, baseDims, newDims, autoFactor) {
  const basis = (l.extra && l.extra.scale_basis) ||
    (l.section === 'hardware' ? 'fixed' : (['material', 'labour', 'machine'].includes(l.section) ? 'auto' : 'fixed'));
  switch (basis) {
    case 'fixed': return 1;
    case 'area': return ratio(dimArea(baseDims), dimArea(newDims));
    case 'perimeter': return ratio(dimPerimeter(baseDims), dimPerimeter(newDims));
    case 'length': return ratio(Number(baseDims && baseDims.length) || 0, Number(newDims && newDims.length) || 0);
    case 'volume': return ratio(dimVolume(baseDims), dimVolume(newDims));
    default: return autoFactor;
  }
}

function scaleCostLines(lines, baseDims, newDims) {
  /* Back-compat: scaleCostLines(lines, factor) with a numeric factor. */
  if (typeof baseDims === 'number') {
    const f = baseDims;
    if (!Number.isFinite(f) || f <= 0 || f === 1) return (lines || []).map(l => ({ ...l }));
    return (lines || []).map(l => (['material', 'labour', 'machine'].includes(l.section) && !(l.extra && l.extra.manual))
      ? { ...l, qty: Math.round(Number(l.qty) * f * 1000) / 1000 } : { ...l });
  }
  const autoFactor = scaleFactor(baseDims, newDims);
  return (lines || []).map(l => {
    if (l.extra && l.extra.manual) return { ...l };
    const f = lineFactor(l, baseDims, newDims, autoFactor);
    if (!Number.isFinite(f) || f <= 0 || f === 1) return { ...l };
    return { ...l, qty: Math.round(Number(l.qty) * f * 1000) / 1000 };
  });
}

module.exports = { r2, roundTo, costLineTotal, productCostSummary, quotationSummary, scaleFactor, scaleCostLines, dimArea, dimVolume, dimPerimeter };
