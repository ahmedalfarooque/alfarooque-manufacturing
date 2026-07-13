'use strict';
/* Part B (scope per owner instruction 2026-07-13: MATERIAL lines only —
   no labour or other cost lines). Loads each product's material lines
   from scripts/staged/costmodels-2026-07-13.json (verbatim from
   Products_Master_RealCosts.xlsx "Cost Models Detail") into
   qt_product_cost_lines:

     · coded lines  → section 'material', source_id = material id
                      (matched by code in the 1,104-item master),
                      qty / unit / unit rate exactly as in Excel.
     · uncoded misc → section 'material', source_id null,
                      name = Excel "Material / Role" text.

   line_total = r2(qty × unit_cost) — same formula as lib/costing with
   waste 0. Sets cost_params {overheadPct:10, riskPct:3, profit 25%} on
   each product. NEVER touches standard_price, last_calculated_cost,
   the materials master, or any labour data.

   Usage: node scripts/load-cost-models-2026-07-13.js */

const fs = require('fs');
const path = require('path');

const env = {};
for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const URL_ = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function rest(pathq, opts = {}) {
  const r = await fetch(URL_ + '/rest/v1/' + pathq, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${pathq} :: ${text.slice(0, 300)}`);
  return { headers: r.headers, body: text ? JSON.parse(text) : null };
}
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

(async () => {
  const models = JSON.parse(fs.readFileSync(path.join(__dirname, 'staged', 'costmodels-2026-07-13.json'), 'utf8'));

  const products = (await rest('qt_catalogue_products?select=id,sku&deleted_at=is.null&limit=1000')).body;
  const bySku = new Map(products.map(p => [p.sku, p.id]));

  const mats = (await rest('qt_materials?select=id,code,name,name_en,name_ar,unit&deleted_at=is.null&limit=2000')).body;
  const matByCode = new Map(mats.map(m => [m.code, m]));

  const skus = Object.keys(models);
  console.log('products in cost sheet:', skus.length, '| in catalogue:', products.length);

  let done = 0, skippedProducts = 0, linked = 0, misc = 0;
  const problems = [];
  const BATCH = 20;

  for (let i = 0; i < skus.length; i++) {
    const sku = skus[i];
    const pid = bySku.get(sku);
    if (!pid) { skippedProducts++; problems.push(`SKU ${sku}: product not found in catalogue`); continue; }

    const matLines = models[sku].lines.filter(l => l.type === 'Material');
    const rows = [];
    for (const l of matLines) {
      const qty = Number(l.qty), rate = Number(l.rate);
      const base = {
        product_id: pid, section: 'material', sort: rows.length,
        qty, unit: l.unit, unit_cost: rate, waste_pct: 0, extra: {},
        line_total: r2(qty * rate),
      };
      if (l.code) {
        const m = matByCode.get(l.code);
        if (!m) { problems.push(`SKU ${sku} row ${l.row}: material code ${l.code} not in master — entered unlinked`); rows.push({ ...base, source_id: null, name: l.role }); misc++; continue; }
        rows.push({ ...base, source_id: m.id, name: m.name });
        linked++;
      } else {
        rows.push({ ...base, source_id: null, name: l.role });
        misc++;
      }
      /* checksum: our computed line total vs Excel's Line Total */
      const lt = rows[rows.length - 1].line_total;
      if (l.ltotal != null && Math.abs(lt - Number(l.ltotal)) > 0.011) {
        problems.push(`SKU ${sku} row ${l.row}: line total ${lt} ≠ Excel ${l.ltotal}`);
      }
    }

    /* replace this product's lines (idempotent re-run safety) */
    await rest(`qt_product_cost_lines?product_id=eq.${pid}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    if (rows.length) await rest('qt_product_cost_lines', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(rows) });

    /* cost summary settings only — nothing else on the product */
    await rest(`qt_catalogue_products?id=eq.${pid}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ cost_params: { overheadPct: 10, riskPct: 3, profitMode: 'pct', profitValue: 25, sellingPrice: 0, rounding: 0 } }),
    });

    done++;
    if (done % BATCH === 0 || i === skus.length - 1) {
      console.log(`BATCH ${Math.ceil(done / BATCH)}: ${done}/${skus.length} products done (linked lines ${linked}, misc ${misc}, problems ${problems.length})`);
    }
  }

  console.log('\nDONE. products:', done, '| skipped:', skippedProducts, '| linked lines:', linked, '| misc lines:', misc);
  problems.slice(0, 40).forEach(p => console.log('  !', p));
  const rc = await rest('qt_product_cost_lines?select=id&limit=1', { headers: { Prefer: 'count=exact' } });
  console.log('total cost lines in DB:', rc.headers.get('content-range').split('/')[1]);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
