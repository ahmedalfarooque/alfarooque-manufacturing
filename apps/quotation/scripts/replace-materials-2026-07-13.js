'use strict';
/* One-time: hard-delete ALL qt_materials, then bulk-import the verified
   master list (scripts/staged/materials-master-2026-07-13.json, generated
   verbatim from Materials_Master_RealPrices.xlsx sheet "Materials").
   Values are inserted exactly as staged — no rounding, no invention.
   Usage: node scripts/replace-materials-2026-07-13.js [--delete-only|--import-only] */

const fs = require('fs');
const path = require('path');

const env = {};
for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const URL_ = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' };

async function rest(pathq, opts = {}) {
  const r = await fetch(URL_ + '/rest/v1/' + pathq, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${pathq} :: ${text.slice(0, 300)}`);
  return { headers: r.headers, body: text ? JSON.parse(text) : null };
}
const count = async (q) =>
  Number((await rest(q + (q.includes('?') ? '&' : '?') + 'select=id&limit=1', { headers: { Prefer: 'count=exact' } }))
    .headers.get('content-range').split('/')[1]);

(async () => {
  const mode = process.argv[2] || '';

  if (mode !== '--import-only') {
    /* ═══ PHASE 1 — HARD DELETE (materials only) ═══ */
    const before = await count('qt_materials');
    console.log('PHASE1 before:', before);
    await rest('qt_materials?id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    const after = await count('qt_materials');
    console.log('PHASE1 after delete:', after);
    if (after !== 0) throw new Error('Materials not empty after delete: ' + after);
  }
  if (mode === '--delete-only') return;

  /* ═══ PHASE 2 — IMPORT ═══ */
  const staged = JSON.parse(fs.readFileSync(path.join(__dirname, 'staged', 'materials-master-2026-07-13.json'), 'utf8'));
  console.log('Staged rows:', staged.length);

  const cats = (await rest('qt_material_categories?select=id,name,kind')).body;
  const catMap = new Map(cats.map(c => [c.kind + '::' + c.name.trim(), c.id]));

  const skipped = [];
  const payloads = [];
  for (const r of staged) {
    const categoryId = catMap.get('material::' + String(r.category || '').trim());
    if (!categoryId) { skipped.push({ excel_row: r.excel_row, code: r.code, reason: 'Category not found: ' + r.category }); continue; }
    const row = {
      code: r.code,
      barcode: r.barcode,
      name: r.name_en || r.name_ar,           // canonical (app convention)
      name_en: r.name_en,
      name_ar: r.name_ar,
      kind: 'material',
      category_id: categoryId,
      unit: r.unit,
      latest_price: r.latest_price,
      currency: 'SAR',
      default_waste_pct: r.waste_pct != null ? r.waste_pct : 0,
      notes: r.notes,
      status: 'active',
    };
    if (r.brand != null) row.brand = r.brand;
    for (const [k, col] of [['height_mm', 'height'], ['width_mm', 'width'], ['length_mm', 'length'], ['thickness_mm', 'thickness']]) {
      if (r[k] != null) { row[col + '_value'] = r[k]; row[col + '_unit'] = 'mm'; }
    }
    payloads.push({ excel_row: r.excel_row, row });
  }

  let done = 0, failed = 0;
  const failures = [];
  const BATCH = 50;
  for (let i = 0; i < payloads.length; i += BATCH) {
    const batch = payloads.slice(i, i + BATCH);
    const bn = i / BATCH + 1;
    try {
      await rest('qt_materials', {
        method: 'POST', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(batch.map(b => b.row)),
      });
      done += batch.length;
      console.log(`BATCH ${bn}: rows ${i + 1}-${i + batch.length} OK (completed ${done}, failures ${failed})`);
    } catch (e) {
      /* batch failed as a whole — retry row-by-row so one bad row doesn't sink 50 */
      let bDone = 0;
      for (const b of batch) {
        try { await rest('qt_materials', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(b.row) }); bDone++; done++; }
        catch (e2) { failed++; failures.push({ excel_row: b.excel_row, code: b.row.code, reason: e2.message }); }
      }
      console.log(`BATCH ${bn}: ${bDone}/${batch.length} OK after row-retry (completed ${done}, failures ${failed})`);
    }
  }

  console.log('\nIMPORT DONE. inserted:', done, 'failed:', failed, 'skipped(category):', skipped.length);
  for (const s of skipped) console.log('SKIP', JSON.stringify(s));
  for (const f of failures) console.log('FAIL', JSON.stringify(f));
  console.log('FINAL COUNT:', await count('qt_materials'));
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
