'use strict';

/* One-off catalogue reset + bulk import from the attached Excel file
   (Products sheet only — Form Field Guide / Category Summary / Needs
   Attention are reference sheets, not data). Runs in a single DB
   transaction: soft-deletes every existing qt_catalogue_products row,
   then inserts the 240 rows from the sheet. Rolls back entirely on any
   error. Does not touch quotations, customers, suppliers, materials,
   labour, machines, expenses, users, categories, settings, reports, or
   audit logs — only qt_catalogue_products.

   Run manually: node scripts/import-excel-products-2026-07-11.js       */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const EXCEL_PATH = 'C:/Users/Arshad_IAAE/OneDrive/Head Office IAAE/Wood Work Factory - WW-03/LIst of Products_Materials_customers_Suppliers etc/All Products_11_07_2026.xlsx';

(function loadEnv() {
  for (const file of [path.join(__dirname, '..', '.env.local')]) {
    try {
      for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
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
  }
})();

const { Client } = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'pg'));

const AR_RE = /[؀-ۿ]/;
function trimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}
function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const url = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!url) { console.error('[import] SUPABASE_DB_URL is not set.'); process.exit(1); }

  console.log('[import] reading', EXCEL_PATH);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);
  const ws = wb.getWorksheet('Products');
  if (!ws) { console.error('[import] "Products" sheet not found.'); process.exit(1); }

  const rows = [];
  ws.eachRow((row, i) => {
    if (i === 1) return; // header
    const arr = [];
    row.eachCell({ includeEmpty: true }, (cell, col) => { arr[col - 1] = cell.value; });
    if (arr.every(v => v === null || v === undefined || v === '')) return; // blank row
    rows.push(arr);
  });
  console.log('[import]', rows.length, 'data rows found');

  const seenSku = new Set();
  const items = [];
  const skipped = [];
  for (let i = 0; i < rows.length; i++) {
    const rowNo = i + 2;
    const [skuRaw, nameEnRaw, nameArRaw, catRaw, subcatRaw, unitRaw, priceRaw, costRaw, lenRaw, widRaw, hgtRaw, thkRaw, descRaw] = rows[i];
    const nameEn = trimOrNull(nameEnRaw);
    const nameAr = trimOrNull(nameArRaw);
    if (!nameEn && !nameAr) { skipped.push(`Row ${rowNo}: no product name`); continue; }
    const sku = trimOrNull(skuRaw);
    if (sku) {
      const key = sku.toUpperCase();
      if (seenSku.has(key)) { skipped.push(`Row ${rowNo}: duplicate SKU ${sku}, skipped`); continue; }
      seenSku.add(key);
    }
    const subcat = trimOrNull(subcatRaw);
    const desc = trimOrNull(descRaw);
    const dims = {};
    const len = numOrNull(lenRaw), wid = numOrNull(widRaw), hgt = numOrNull(hgtRaw), thk = numOrNull(thkRaw);
    if (len) dims.length = len;
    if (wid) dims.width = wid;
    if (hgt) dims.height = hgt;
    if (thk) dims.thickness = thk;

    items.push({
      code: sku, sku,
      name: nameEn || nameAr, name_en: nameEn, name_ar: nameAr,
      category: trimOrNull(catRaw),
      sub_category: subcat,
      sub_category_en: subcat && !AR_RE.test(subcat) ? subcat : null,
      sub_category_ar: subcat && AR_RE.test(subcat) ? subcat : null,
      unit: trimOrNull(unitRaw) || 'nos',
      standard_price: numOrNull(priceRaw) || 0,
      last_calculated_cost: numOrNull(costRaw),
      last_costed_at: numOrNull(costRaw) != null ? new Date().toISOString() : null,
      dimensions: dims,
      description: desc, description_en: desc && !AR_RE.test(desc) ? desc : null, description_ar: desc && AR_RE.test(desc) ? desc : null,
    });
  }
  console.log('[import]', items.length, 'valid rows,', skipped.length, 'skipped');
  if (skipped.length) skipped.forEach(s => console.log('  -', s));

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('BEGIN');

    const { rows: adminRows } = await client.query(
      "select id from platform_users where lower(email) = 'arshad@alfarooque.com' limit 1"
    );
    const actorId = adminRows[0] ? adminRows[0].id : null;

    const { rowCount: beforeCount } = await client.query(
      'select 1 from qt_catalogue_products where deleted_at is null'
    );
    const resetRes = await client.query(
      'update qt_catalogue_products set deleted_at = now(), updated_at = now(), updated_by = $1 where deleted_at is null',
      [actorId]
    );
    console.log('[import] soft-deleted', resetRes.rowCount, 'existing products (of', beforeCount, 'active)');

    let inserted = 0;
    for (const it of items) {
      await client.query(
        `insert into qt_catalogue_products
           (code, sku, name, name_en, name_ar, category, sub_category, sub_category_en, sub_category_ar,
            unit, standard_price, last_calculated_cost, last_costed_at, dimensions,
            description, description_en, description_ar, status, created_by, updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'active',$18,$18)`,
        [it.code, it.sku, it.name, it.name_en, it.name_ar, it.category, it.sub_category, it.sub_category_en, it.sub_category_ar,
          it.unit, it.standard_price, it.last_calculated_cost, it.last_costed_at, JSON.stringify(it.dimensions),
          it.description, it.description_en, it.description_ar, actorId]
      );
      inserted++;
    }

    await client.query(
      `insert into qt_audit_logs (table_name, record_id, action, old_data, new_data, actor_id)
       values ('qt_catalogue_products', null, 'insert', null, $1, $2)`,
      [JSON.stringify({ import: 'excel-products-2026-07-11', reset: resetRes.rowCount, inserted, skipped: skipped.length }), actorId]
    );

    await client.query('COMMIT');
    console.log('[import] COMMIT — inserted', inserted, 'products.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[import] FAILED, rolled back:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(e => { console.error('[import]', e.message); process.exit(1); });
