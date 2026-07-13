'use strict';
/* Part A: rebuild the product catalogue from
   scripts/staged/products-master-2026-07-13.json (generated verbatim from
   Products_Master_RealCosts.xlsx, sheet "Products", header row 3).

   A1 — delete ALL existing qt_catalogue_products rows:
        · rows referenced by quotation lines (FK, no cascade) → soft-delete
        · everything else → hard delete
   A2 — insert the 240 staged products in batches of 40, values verbatim.
   Only qt_catalogue_products is touched (cost lines / price history are
   empty; cascades cover them). Materials, quotations, customers untouched.

   Usage: node scripts/replace-products-2026-07-13.js */

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
const count = async (q) =>
  Number((await rest(q + (q.includes('?') ? '&' : '?') + 'select=id&limit=1', { headers: { Prefer: 'count=exact' } }))
    .headers.get('content-range').split('/')[1]);

const AR = /[؀-ۿ]/;

(async () => {
  /* ═══ A1 — DELETE ═══ */
  console.log('before: total', await count('qt_catalogue_products'),
    '| active', await count('qt_catalogue_products?deleted_at=is.null'));

  /* products referenced by quotation lines — must survive as soft-deleted */
  const refs = (await rest('qt_quotation_products?select=catalogue_product_id&catalogue_product_id=not.is.null&limit=10000')).body;
  const keep = [...new Set(refs.map(x => x.catalogue_product_id))];
  console.log('referenced by quotations (soft-delete):', keep.length);

  if (keep.length) {
    await rest('qt_catalogue_products?id=in.(' + keep.join(',') + ')&deleted_at=is.null', {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ deleted_at: new Date().toISOString(), status: 'archived' }),
    });
    await rest('qt_catalogue_products?id=not.in.(' + keep.join(',') + ')', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  } else {
    await rest('qt_catalogue_products?id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  }
  const active = await count('qt_catalogue_products?deleted_at=is.null');
  console.log('after delete: total', await count('qt_catalogue_products'), '| active', active);
  if (active !== 0) throw new Error('Active products not 0 after delete: ' + active);

  /* ═══ A2 — IMPORT (batches of 40) ═══ */
  const staged = JSON.parse(fs.readFileSync(path.join(__dirname, 'staged', 'products-master-2026-07-13.json'), 'utf8'));
  console.log('staged products:', staged.length);
  const nowIso = new Date().toISOString();

  const payloads = staged.map(p => ({
    code: p.sku, sku: p.sku, barcode: p.sku,
    name: p.name_en || p.name_ar, name_en: p.name_en, name_ar: p.name_ar,
    category: p.category,
    sub_category: p.sub_category,
    sub_category_en: p.sub_category && !AR.test(p.sub_category) ? p.sub_category : null,
    sub_category_ar: p.sub_category && AR.test(p.sub_category) ? p.sub_category : null,
    unit: p.unit || 'nos',
    standard_price: p.unit_price != null ? p.unit_price : 0,
    last_calculated_cost: p.cost,
    last_costed_at: p.cost != null ? nowIso : null,
    dimensions: p.dimensions || {},
    description: p.description_en || p.description_ar,
    description_en: p.description_en, description_ar: p.description_ar,
    status: 'active',
  }));

  let done = 0, failed = 0;
  const failures = [];
  const BATCH = 40;
  for (let i = 0; i < payloads.length; i += BATCH) {
    const batch = payloads.slice(i, i + BATCH);
    const bn = i / BATCH + 1;
    try {
      await rest('qt_catalogue_products', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(batch) });
      done += batch.length;
      console.log(`BATCH ${bn}: rows ${i + 1}-${i + batch.length} OK (created ${done}, failures ${failed})`);
    } catch (e) {
      for (let j = 0; j < batch.length; j++) {
        try { await rest('qt_catalogue_products', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(batch[j]) }); done++; }
        catch (e2) { failed++; failures.push({ sku: batch[j].sku, reason: e2.message }); }
      }
      console.log(`BATCH ${bn}: finished with row-retry (created ${done}, failures ${failed})`);
    }
  }
  console.log('\nIMPORT DONE. created:', done, 'failed:', failed);
  failures.forEach(f => console.log('FAIL', JSON.stringify(f)));
  console.log('FINAL active count:', await count('qt_catalogue_products?deleted_at=is.null'));
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
