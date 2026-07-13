'use strict';
/* A3 verification: compare EVERY active qt_catalogue_products row against
   the staged master JSON, field by field. */
const fs = require('fs');
const path = require('path');

const env = {};
for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const URL_ = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

(async () => {
  const staged = JSON.parse(fs.readFileSync(path.join(__dirname, 'staged', 'products-master-2026-07-13.json'), 'utf8'));
  const r = await fetch(URL_ + '/rest/v1/qt_catalogue_products?select=sku,code,barcode,name_en,name_ar,category,sub_category,unit,standard_price,last_calculated_cost,dimensions,description_en,description_ar,status&deleted_at=is.null&limit=1000', { headers: H });
  const db = await r.json();
  console.log('ACTIVE in DB:', db.length, '| staged:', staged.length);

  const bySku = new Map(db.map(p => [p.sku, p]));
  const num = v => (v == null ? null : Number(v));
  let bad = 0; const report = [];
  for (const s of staged) {
    const p = bySku.get(s.sku);
    if (!p) { bad++; report.push('MISSING ' + s.sku); continue; }
    const dims = p.dimensions || {};
    const sdims = s.dimensions || {};
    const checks = [
      ['code', p.code, s.sku],
      ['name_en', p.name_en, s.name_en],
      ['name_ar', p.name_ar, s.name_ar],
      ['category', p.category, s.category],
      ['sub_category', p.sub_category, s.sub_category],
      ['unit', p.unit, s.unit],
      ['price', num(p.standard_price), s.unit_price != null ? s.unit_price : 0],
      ['cost', num(p.last_calculated_cost), s.cost],
      ['desc_en', p.description_en, s.description_en],
      ['desc_ar', p.description_ar, s.description_ar],
      ['dim.length', num(dims.length), sdims.length ?? null],
      ['dim.width', num(dims.width), sdims.width ?? null],
      ['dim.height', num(dims.height), sdims.height ?? null],
      ['dim.thickness', num(dims.thickness), sdims.thickness ?? null],
      ['status', p.status, 'active'],
    ];
    const diffs = checks.filter(([, a, b]) => (a ?? null) !== (b ?? null));
    if (diffs.length) { bad++; report.push('DIFF ' + s.sku + ': ' + diffs.map(([f, a, b]) => `${f} db=${JSON.stringify(a)} xl=${JSON.stringify(b)}`).join(' | ')); }
  }
  console.log('mismatches/missing:', bad);
  report.slice(0, 20).forEach(x => console.log(' ', x));

  const noCost = db.filter(p => p.last_calculated_cost == null);
  console.log('products with empty Cost:', noCost.length, noCost.slice(0, 5).map(p => p.sku));

  console.log('\nSPOT CHECKS:');
  for (const sku of ['9000330', '9000135', '97456838', '50267', '900017', '9000044', '2458079', '82741588']) {
    const p = bySku.get(sku);
    if (!p) { console.log(` ${sku}: NOT FOUND`); continue; }
    console.log(` ${sku}: price=${p.standard_price} cost=${p.last_calculated_cost} cat="${p.category}" sub="${p.sub_category || ''}" unit=${p.unit} dims=${JSON.stringify(p.dimensions)}`);
    console.log(`   EN: ${(p.name_en || '').slice(0, 60)}`);
    console.log(`   AR: ${(p.name_ar || '').slice(0, 60)}`);
    console.log(`   descEN(${(p.description_en || '').length}ch): ${(p.description_en || '').slice(0, 70)}`);
    console.log(`   descAR(${(p.description_ar || '').length}ch): ${(p.description_ar || '').slice(0, 70)}`);
  }

  console.log('\nPER-CATEGORY COUNTS:');
  const cats = {};
  db.forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
  Object.entries(cats).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c}: ${n}`));

  const rm = await fetch(URL_ + '/rest/v1/qt_materials?select=id&deleted_at=is.null&limit=1', { headers: { ...H, Prefer: 'count=exact' } });
  console.log('\nMaterials count (must be 1104):', rm.headers.get('content-range').split('/')[1]);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
