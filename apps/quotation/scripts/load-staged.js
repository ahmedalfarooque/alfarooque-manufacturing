'use strict';

/* Loads scripts/staged/*.json (produced by the WW-03 folder analysis)
   into the quotation database via the service-role key. Idempotent:
   dedupes against existing rows by name/code, records completion in
   qt_settings('staged_import') so predev re-runs are no-ops.
   Refuses to run against an unmigrated schema (single-language model
   required). --if-ready: exit 0 quietly when schema/marker not ready. */

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

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const soft = process.argv.includes('--if-ready');
const STAGED = path.join(__dirname, 'staged');
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(STAGED, f), 'utf8'));
const result = { materials: 0, products: 0, customers: 0, suppliers: 0, machines: 0,
  skipped_duplicates: 0, price_points: 0, formulas: 0, errors: [] };

async function schemaReady() {
  const { error } = await sb.from('qt_materials').select('name').limit(1);
  return !error;
}

async function existingSet(table, col) {
  const out = new Set();
  let from = 0;
  for (;;) {
    const { data } = await sb.from(table).select(col).range(from, from + 999);
    if (!data || !data.length) break;
    data.forEach(r => r[col] && out.add(String(r[col]).trim().toLowerCase()));
    if (data.length < 1000) break;
    from += 1000;
  }
  return out;
}

async function batchInsert(table, rows, tag) {
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { error } = await sb.from(table).insert(chunk);
    if (error) { result.errors.push(tag + ': ' + error.message); return false; }
    result[tag] += chunk.length;
  }
  return true;
}

async function main() {
  if (!fs.existsSync(path.join(STAGED, 'materials.json'))) {
    console.log('[load] no staged data — run the analysis first.'); process.exitCode = soft ? 0 : 1; return;
  }
  if (!(await schemaReady())) {
    const msg = '[load] database schema not migrated yet — staged data is ready and will load automatically after migration.';
    if (soft) { console.warn(msg); process.exitCode = 0; return; }
    console.error(msg); process.exitCode = 1; return;
  }
  const { data: marker } = await sb.from('qt_settings').select('id').eq('key', 'staged_import').is('entity_id', null).maybeSingle();
  if (marker) {
    console.log('[load] staged import already completed earlier — skipping (delete qt_settings key "staged_import" to re-run).');
    process.exitCode = 0; return;
  }

  /* ── Suppliers ── */
  const sup = readJson('suppliers.json');
  const supSeen = await existingSet('qt_suppliers', 'name');
  const supRows = sup.filter(s => !supSeen.has(s.name.trim().toLowerCase()))
    .map(s => ({ ...s, status: 'active', country: 'Saudi Arabia', currency: 'SAR' }));
  result.skipped_duplicates += sup.length - supRows.length;
  await batchInsert('qt_suppliers', supRows, 'suppliers');

  /* ── Customers ── */
  const cus = readJson('customers.json');
  const cusSeen = await existingSet('qt_customers', 'company_name');
  const cusRows = cus.filter(c => !cusSeen.has(c.company_name.trim().toLowerCase()))
    .map(c => ({ ...c, customer_type: 'other', status: 'active' }));
  result.skipped_duplicates += cus.length - cusRows.length;
  await batchInsert('qt_customers', cusRows, 'customers');

  /* ── Machines ── */
  const mac = readJson('machines.json');
  const macSeen = await existingSet('qt_machines', 'name');
  const macRows = mac.filter(m => !macSeen.has(m.name.trim().toLowerCase()))
    .map(m => ({ ...m, hourly_cost: 0, setup_cost: 0, status: 'active' }));
  result.skipped_duplicates += mac.length - macRows.length;
  await batchInsert('qt_machines', macRows, 'machines');

  /* ── Materials (+ initial price history) ── */
  const mat = readJson('materials.json');
  const matSeen = await existingSet('qt_materials', 'name');
  const matRows = mat.filter(m => !matSeen.has(m.name.trim().toLowerCase()))
    .map(m => ({ ...m, default_waste_pct: 0, status: 'active' }));
  result.skipped_duplicates += mat.length - matRows.length;
  if (await batchInsert('qt_materials', matRows, 'materials')) {
    /* initial price point per imported material with a price */
    let from = 0;
    const priced = [];
    for (;;) {
      const { data } = await sb.from('qt_materials').select('id, latest_price, notes')
        .gt('latest_price', 0).like('notes', 'Smart Life inventory%').range(from, from + 999);
      if (!data || !data.length) break;
      priced.push(...data);
      if (data.length < 1000) break;
      from += 1000;
    }
    for (let i = 0; i < priced.length; i += 500) {
      const { error } = await sb.from('qt_material_price_history').insert(priced.slice(i, i + 500).map(m => ({
        material_id: m.id, price: m.latest_price, source: 'import', source_ref: 'smart-life-inventory',
      })));
      if (error) { result.errors.push('price_history: ' + error.message); break; }
      result.price_points += Math.min(500, priced.length - i);
    }
  }

  /* ── Products (sequence-backed codes, dimensions → parametric params) ── */
  const prod = readJson('products.json');
  const prodSeen = await existingSet('qt_catalogue_products', 'name');
  for (const p of prod) {
    if (prodSeen.has(p.name.trim().toLowerCase())) { result.skipped_duplicates++; continue; }
    const { data: code } = await sb.rpc('qt_next_product_code');
    const row = {
      code: code || ('P-' + Date.now() + '-' + result.products),
      name: p.name, category: p.category || 'OTHER', unit: p.unit || 'nos',
      description: p.description || null, barcode: p.barcode || null,
      standard_price: Number(p.standard_price) || 0,
      last_calculated_cost: Number(p.cost) > 0 ? Number(p.cost) : null,
      dimensions: p.dimensions || {}, cost_params: p.cost_params || {},
      notes: 'Imported from ' + (p.source || 'WW-03 analysis'),
      status: 'active',
    };
    const { error } = await sb.from('qt_catalogue_products').insert(row);
    if (error) { result.errors.push('product "' + p.name.slice(0, 30) + '": ' + error.message); continue; }
    result.products++;
    if (p.dimensions && Object.keys(p.dimensions).length) result.formulas++;
  }

  await sb.from('qt_settings').insert({ entity_id: null, key: 'staged_import', value: { ...result, at: new Date().toISOString() } });
  fs.writeFileSync(path.join(STAGED, 'load-result.json'), JSON.stringify(result, null, 1));
  console.log('[load] DONE', JSON.stringify(result));
  process.exitCode = result.errors.length ? 1 : 0;
}

main().catch(e => { console.error("[load] " + e.message); process.exitCode = 1; });
