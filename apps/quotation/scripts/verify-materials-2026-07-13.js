'use strict';
/* Phase 3 verification: compare EVERY qt_materials row against the staged
   master JSON (field-by-field), report spot-checks + category totals. */
const fs = require('fs');
const path = require('path');

const env = {};
for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const URL_ = env.SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };

async function getAll() {
  const out = [];
  for (let off = 0; ; off += 1000) {
    const r = await fetch(URL_ + `/rest/v1/qt_materials?select=code,barcode,name,name_en,name_ar,kind,unit,brand,latest_price,default_waste_pct,notes,status,height_value,height_unit,width_value,width_unit,length_value,length_unit,thickness_value,thickness_unit,category_id,deleted_at&order=code&offset=${off}&limit=1000`, { headers: H });
    const j = await r.json();
    out.push(...j);
    if (j.length < 1000) break;
  }
  return out;
}

(async () => {
  const staged = JSON.parse(fs.readFileSync(path.join(__dirname, 'staged', 'materials-master-2026-07-13.json'), 'utf8'));
  const cats = await (await fetch(URL_ + '/rest/v1/qt_material_categories?select=id,name', { headers: H })).json();
  const catName = new Map(cats.map(c => [c.id, c.name]));
  const db = await getAll();
  console.log('TOTAL in DB:', db.length, '| staged:', staged.length);

  const byCode = new Map(db.map(m => [m.code, m]));
  const num = v => (v == null ? null : Number(v));
  let mismatches = 0;
  const report = [];
  for (const s of staged) {
    const m = byCode.get(s.code);
    if (!m) { mismatches++; report.push(`MISSING code=${s.code}`); continue; }
    const checks = [
      ['barcode', m.barcode, s.barcode],
      ['name_en', m.name_en, s.name_en],
      ['name_ar', m.name_ar, s.name_ar],
      ['category', catName.get(m.category_id), s.category],
      ['unit', m.unit, s.unit],
      ['brand', m.brand, s.brand],
      ['latest_price', num(m.latest_price), s.latest_price],
      ['waste', num(m.default_waste_pct), s.waste_pct != null ? s.waste_pct : 0],
      ['notes', m.notes, s.notes],
      ['height', num(m.height_value), s.height_mm],
      ['width', num(m.width_value), s.width_mm],
      ['length', num(m.length_value), s.length_mm],
      ['thickness', num(m.thickness_value), s.thickness_mm],
      ['h_unit', m.height_unit, s.height_mm != null ? 'mm' : null],
      ['w_unit', m.width_unit, s.width_mm != null ? 'mm' : null],
      ['l_unit', m.length_unit, s.length_mm != null ? 'mm' : null],
      ['t_unit', m.thickness_unit, s.thickness_mm != null ? 'mm' : null],
      ['kind', m.kind, 'material'],
      ['status', m.status, 'active'],
      ['deleted_at', m.deleted_at, null],
    ];
    const bad = checks.filter(([, a, b]) => (a == null ? null : a) !== (b == null ? null : b) && !(typeof a === 'number' && typeof b === 'number' && a === b));
    if (bad.length) { mismatches++; report.push(`DIFF code=${s.code}: ` + bad.map(([f, a, b]) => `${f} db=${JSON.stringify(a)} xl=${JSON.stringify(b)}`).join(' | ')); }
  }
  console.log('Field mismatches / missing:', mismatches);
  report.slice(0, 30).forEach(r => console.log(' ', r));

  /* spot checks */
  console.log('\nSPOT CHECKS:');
  for (const c of ['98011672', '27138237', '75023147', '15086384', '11432668', '62414971', '03735476', '3735476', '10113']) {
    const m = byCode.get(c);
    if (!m) { console.log(` ${c}: NOT IN DB`); continue; }
    console.log(` ${c}: price=${m.latest_price} unit=${m.unit} cat=${catName.get(m.category_id)} en="${m.name_en}" ar="${m.name_ar}" barcode=${m.barcode} dims[HxWxLxT]=${m.height_value},${m.width_value},${m.length_value},${m.thickness_value}`);
  }

  /* category totals */
  console.log('\nCATEGORY TOTALS (DB):');
  const totals = {};
  for (const m of db) { const n = catName.get(m.category_id) || '??'; totals[n] = (totals[n] || 0) + 1; }
  Object.entries(totals).sort((a, b) => b[1] - a[1]).forEach(([n, c]) => console.log(`  ${n}: ${c}`));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
