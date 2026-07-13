'use strict';
/* B3/B4 verification: per-product DB material-line sums vs Excel,
   product price/cost fields untouched, materials master untouched. */
const fs = require('fs');
const path = require('path');

const env = {};
for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const URL_ = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

(async () => {
  const models = JSON.parse(fs.readFileSync(path.join(__dirname, 'staged', 'costmodels-2026-07-13.json'), 'utf8'));
  const stagedProducts = JSON.parse(fs.readFileSync(path.join(__dirname, 'staged', 'products-master-2026-07-13.json'), 'utf8'));

  const products = await (await fetch(URL_ + '/rest/v1/qt_catalogue_products?select=id,sku,standard_price,last_calculated_cost&deleted_at=is.null&limit=1000', { headers: H })).json();
  const bySku = new Map(products.map(p => [p.sku, p]));

  const lines = [];
  for (let off = 0; ; off += 1000) {
    const j = await (await fetch(URL_ + `/rest/v1/qt_product_cost_lines?select=product_id,section,source_id,qty,unit,unit_cost,line_total&offset=${off}&limit=1000`, { headers: H })).json();
    lines.push(...j);
    if (j.length < 1000) break;
  }
  console.log('cost lines in DB:', lines.length);
  const byPid = new Map();
  lines.forEach(l => { if (!byPid.has(l.product_id)) byPid.set(l.product_id, []); byPid.get(l.product_id).push(l); });
  console.log('products with cost lines:', byPid.size, '/ 240');

  let ok = 0, small = 0, bigMismatch = 0, lineCountMismatch = 0;
  const reports = [];
  for (const [sku, model] of Object.entries(models)) {
    const p = bySku.get(sku);
    const dbLines = byPid.get(p.id) || [];
    const excelMat = model.lines.filter(l => l.type === 'Material');
    if (dbLines.length !== excelMat.length) { lineCountMismatch++; reports.push(`SKU ${sku}: ${dbLines.length} lines vs Excel ${excelMat.length}`); continue; }
    const dbSum = r2(dbLines.reduce((s, l) => s + Number(l.line_total), 0));
    const xlSum = r2(excelMat.reduce((s, l) => s + Number(l.ltotal || 0), 0));
    const diff = r2(Math.abs(dbSum - xlSum));
    if (diff === 0) ok++;
    else if (diff <= Math.max(1, xlSum * 0.005)) small++;   // sheet qty-rounding artefacts
    else { bigMismatch++; reports.push(`SKU ${sku}: DB materials ${dbSum} vs Excel ${xlSum} (diff ${diff})`); }
  }
  console.log('materials-subtotal exact:', ok, '| tiny rounding diff:', small, '| REAL mismatches:', bigMismatch, '| line-count mismatches:', lineCountMismatch);
  reports.slice(0, 15).forEach(x => console.log('  !', x));

  /* product fields untouched vs Part A staged values */
  let priceTouched = 0, costTouched = 0;
  for (const s of stagedProducts) {
    const p = bySku.get(s.sku);
    if (Number(p.standard_price) !== (s.unit_price != null ? s.unit_price : 0)) priceTouched++;
    if (Number(p.last_calculated_cost) !== s.cost) costTouched++;
  }
  console.log('unit prices altered:', priceTouched, '| imported costs altered:', costTouched);

  const rm = await fetch(URL_ + '/rest/v1/qt_materials?select=id&deleted_at=is.null&limit=1', { headers: { ...H, Prefer: 'count=exact' } });
  console.log('materials master count:', rm.headers.get('content-range').split('/')[1]);

  console.log('\nSPOT CHECKS (materials subtotal + full-model comparison):');
  for (const sku of ['9000330', '9000135', '97456838', '50267', '900017']) {
    const p = bySku.get(sku);
    const dbLines = byPid.get(p.id) || [];
    const dbSum = r2(dbLines.reduce((s, l) => s + Number(l.line_total), 0));
    const model = models[sku];
    const xlMat = r2(model.lines.filter(l => l.type === 'Material').reduce((s, l) => s + Number(l.ltotal || 0), 0));
    const xlChecksum = model.total ? model.total.ltotal : null;
    console.log(` ${sku}: DB materials=${dbSum} | Excel materials=${xlMat} | Excel TOTAL checksum (incl. labour+OH+risk, not entered)=${xlChecksum} | lines=${dbLines.length}`);
  }
})().catch(e => { console.error('FATAL', e); process.exit(1); });
