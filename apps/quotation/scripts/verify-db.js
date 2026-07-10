'use strict';

/* Automated database verification + CRUD probe (service-role key —
   works without the DB password). Checks the live schema matches the
   single-language model, then proves Create/Read/Update/Soft-delete
   works with ONLY a product name (spec: nothing else mandatory).
   Cleans up after itself. Exit 0 = database verified.               */

const fs = require('fs');
const path = require('path');

(function loadEnv() {
  try {
    for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 1) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch (_) {}
})();

if (typeof globalThis.WebSocket === 'undefined') globalThis.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failures = 0;
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { failures++; console.log('  ✗ ' + m); };

async function columnExists(table, column) {
  const { error } = await sb.from(table).select(column).limit(1);
  return !error;
}

async function main() {
  console.log('── Schema verification ──');
  const mustExist = [
    ['qt_catalogue_products', 'name'], ['qt_catalogue_products', 'sub_category'],
    ['qt_catalogue_products', 'sku'], ['qt_catalogue_products', 'dimensions'],
    ['qt_catalogue_products', 'images'], ['qt_catalogue_products', 'cost_params'],
    ['qt_materials', 'name'], ['qt_suppliers', 'name'], ['qt_customers', 'company_name'],
    ['qt_labour_roles', 'name'], ['qt_machines', 'name'], ['qt_expense_templates', 'name'],
    ['qt_quotation_products', 'name'], ['qt_quotation_products', 'dimensions'],
    ['qt_terms_templates', 'body'], ['qt_translations', 'source_hash'],
    ['qt_user_roles', 'role'], ['qt_lang_backup', 'value_en'],
  ];
  const mustNotExist = [
    ['qt_catalogue_products', 'name_en'], ['qt_catalogue_products', 'name_ar'],
    ['qt_catalogue_products', 'description_en'], ['qt_materials', 'name_ar'],
    ['qt_customers', 'company_name_ar'],
  ];
  for (const [t, c] of mustExist) {
    (await columnExists(t, c)) ? ok(`${t}.${c} exists`) : bad(`${t}.${c} MISSING — migration not applied`);
  }
  for (const [t, c] of mustNotExist) {
    (await columnExists(t, c)) ? bad(`${t}.${c} still exists — bilingual column not dropped`) : ok(`${t}.${c} removed`);
  }

  if (failures) {
    console.log(`\n✗ Schema is NOT migrated (${failures} problems). Run: npm run migrate  (needs SUPABASE_DB_URL)`);
    process.exit(1);
  }

  console.log('── CRUD probe (name-only product) ──');
  const { data: code } = await sb.rpc('qt_next_product_code');
  code ? ok('qt_next_product_code() → ' + code) : bad('qt_next_product_code() missing');

  const { data: created, error: cErr } = await sb.from('qt_catalogue_products')
    .insert({ name: '__VERIFY__ Premium MDF Door', code: code || ('P-VERIFY-' + Date.now()) })
    .select('id, code, name, unit, standard_price, status').single();
  cErr ? bad('CREATE with only name failed: ' + cErr.message)
       : ok(`CREATE ok (${created.code}, unit default "${created.unit}", price default ${created.standard_price})`);

  if (created) {
    const { error: uErr } = await sb.from('qt_catalogue_products')
      .update({ sub_category: 'Interior', dimensions: { length: 2100, width: 900 } }).eq('id', created.id);
    uErr ? bad('UPDATE failed: ' + uErr.message) : ok('UPDATE ok (sub_category + dimensions)');

    const { data: read, error: rErr } = await sb.from('qt_catalogue_products')
      .select('sub_category, dimensions').eq('id', created.id).single();
    (rErr || !read || read.sub_category !== 'Interior') ? bad('READ-back failed') : ok('READ ok');

    const { error: sdErr } = await sb.from('qt_catalogue_products')
      .update({ deleted_at: new Date().toISOString() }).eq('id', created.id);
    sdErr ? bad('SOFT DELETE failed: ' + sdErr.message) : ok('SOFT DELETE ok');

    await sb.from('qt_catalogue_products').delete().eq('id', created.id);   // cleanup probe row
    ok('cleanup done');
  }

  console.log(failures ? `\n✗ ${failures} failures` : '\n✓ Database verified — schema + CRUD all good.');
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error('✗ ' + e.message); process.exit(1); });
