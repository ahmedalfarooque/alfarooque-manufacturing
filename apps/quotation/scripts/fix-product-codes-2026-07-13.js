'use strict';
/* Follow-up to replace-products: the 23 soft-deleted products kept for
   quotation FK integrity still occupied their unique `code` values,
   blocking 18 of the 240 new inserts. Rename archived rows' codes to
   "<code>~archived~<id-prefix>" (quotations reference them by id, never
   by code), then insert the still-missing staged products. */

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

const AR = /[؀-ۿ]/;

(async () => {
  /* 1 — free the codes held by archived rows */
  const archived = (await rest('qt_catalogue_products?select=id,code&deleted_at=not.is.null&code=not.like.*~archived~*')).body;
  console.log('archived rows still holding plain codes:', archived.length);
  for (const a of archived) {
    await rest(`qt_catalogue_products?id=eq.${a.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ code: `${a.code}~archived~${a.id.slice(0, 8)}` }),
    });
  }
  console.log('codes freed.');

  /* 2 — insert whichever staged products are still missing */
  const staged = JSON.parse(fs.readFileSync(path.join(__dirname, 'staged', 'products-master-2026-07-13.json'), 'utf8'));
  const existing = (await rest('qt_catalogue_products?select=sku&deleted_at=is.null&limit=1000')).body;
  const have = new Set(existing.map(x => x.sku));
  const missing = staged.filter(p => !have.has(p.sku));
  console.log('active now:', existing.length, '| missing:', missing.length);

  const nowIso = new Date().toISOString();
  let done = 0; const failures = [];
  for (const p of missing) {
    const row = {
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
    };
    try { await rest('qt_catalogue_products', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) }); done++; }
    catch (e) { failures.push({ sku: p.sku, reason: e.message }); }
  }
  console.log('inserted:', done, '| failed:', failures.length);
  failures.forEach(f => console.log('FAIL', JSON.stringify(f)));
  const r = await rest('qt_catalogue_products?select=id&deleted_at=is.null&limit=1', { headers: { Prefer: 'count=exact' } });
  console.log('FINAL active count:', r.headers.get('content-range').split('/')[1]);
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
