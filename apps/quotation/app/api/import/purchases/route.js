'use strict';

/* Imports the "Purchases Products Report" export (مخزن المصنع):
   ID | Date | Reference No | Supplier | Product Code | Product Name |
   Quantity | Unit | Unit cost | Tax | Discount | Total | Payment Status | Status

   Per spec §21.1: upserts suppliers by Arabic name, matches materials by
   product code then by name (creates new ones), appends a
   qt_material_price_history point per line (source 'purchase_report'),
   updates latest_price from the newest purchase per material, and
   maintains qt_material_suppliers. Admin only. */

const ExcelJS = require('exceljs');
const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');

export const runtime = 'nodejs';
export const maxDuration = 300;

const HARDWARE_HINTS = ['براغي', 'برغي', 'مفصل', 'مسكة', 'مقبض', 'كالون', 'قفل', 'سكة', 'سكك',
  'فتنج', 'صامول', 'مسمار', 'بركلوز', 'جريلة', 'اكسسوار', 'hinge', 'lock', 'handle', 'screw'];

function cellText(row, i) {
  const v = row.getCell(i).value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && v.richText) return v.richText.map(r => r.text).join('');
  if (typeof v === 'object' && v.result !== undefined) return String(v.result);
  if (typeof v === 'object' && v.text) return String(v.text);
  return String(v).trim();
}
function toNum(s) { const n = parseFloat(String(s).replace(/[^\d.\-]/g, '')); return Number.isFinite(n) ? n : 0; }
function toDate(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}
function guessKind(name) {
  const n = String(name || '').toLowerCase();
  return HARDWARE_HINTS.some(h => n.includes(h)) ? 'hardware' : 'material';
}

export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;

  let buf;
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'No file uploaded.' }, 400);
    buf = Buffer.from(await file.arrayBuffer());
  } catch (e) { return json({ error: 'Could not read upload: ' + e.message }, 400); }

  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf); } catch (e) { return json({ error: 'Not a valid .xlsx file.' }, 400); }
  const ws = wb.worksheets[0];
  if (!ws) return json({ error: 'Workbook has no sheets.' }, 400);

  /* Map columns from the header row. */
  const header = {};
  ws.getRow(1).eachCell((cell, col) => { header[String(cell.value || '').trim().toLowerCase()] = col; });
  const col = (name) => header[name];
  const required = ['date', 'supplier', 'product code', 'product name', 'unit', 'unit cost'];
  for (const r of required) if (!col(r)) return json({ error: `Missing column "${r}" — is this the Purchases Products Report?` }, 400);

  const sb = getDb();

  /* Preload caches. */
  const { data: sups } = await sb.from('qt_suppliers').select('id, name').is('deleted_at', null);
  const supByName = new Map((sups || []).map(s => [(s.name || '').trim(), s.id]).filter(([k]) => k));
  const { data: mats } = await sb.from('qt_materials').select('id, code, name, latest_price').is('deleted_at', null);
  const matByCode = new Map((mats || []).map(m => [(m.code || '').trim(), m]));
  const matByName = new Map((mats || []).map(m => [(m.name || '').trim(), m]));

  let suppliersCreated = 0, materialsCreated = 0, pricePoints = 0, skipped = 0, rowsRead = 0;
  const priceRows = [];
  const newest = new Map();       // material_id → { date, price, supplierId }
  const pairSeen = new Map();     // material_id|supplier_id → { date, price }

  const rows = [];
  ws.eachRow((row, n) => { if (n > 1) rows.push(row); });

  for (const row of rows) {
    rowsRead++;
    const supplierName = cellText(row, col('supplier')).trim();
    const code = cellText(row, col('product code')).trim();
    const name = cellText(row, col('product name')).trim();
    const unit = cellText(row, col('unit')).trim() || 'piece';
    const unitCost = toNum(cellText(row, col('unit cost')));
    const date = toDate(cellText(row, col('date'))) || new Date().toISOString().slice(0, 10);
    const refNo = col('reference no') ? cellText(row, col('reference no')).trim() : '';
    if (!name || unitCost <= 0) { skipped++; continue; }

    /* Supplier upsert (by name). */
    let supplierId = supByName.get(supplierName) || null;
    if (!supplierId && supplierName) {
      const { data: ns, error } = await sb.from('qt_suppliers')
        .insert({ name: supplierName, status: 'active', created_by: session.sub, updated_by: session.sub })
        .select('id').single();
      if (!error && ns) { supplierId = ns.id; supByName.set(supplierName, ns.id); suppliersCreated++; }
    }

    /* Material match: code → name → create. */
    let mat = (code && matByCode.get(code)) || matByName.get(name) || null;
    if (!mat) {
      const { data: nm, error } = await sb.from('qt_materials').insert({
        code: code || null, name, kind: guessKind(name), unit,
        default_supplier_id: supplierId, latest_price: unitCost, default_waste_pct: 0,
        status: 'active', notes: 'Created by purchases import',
        created_by: session.sub, updated_by: session.sub,
      }).select('id, code, name, latest_price').single();
      if (error || !nm) { skipped++; continue; }
      mat = nm; materialsCreated++;
      if (code) matByCode.set(code, mat);
      matByName.set(name, mat);
    }

    priceRows.push({
      material_id: mat.id, price: unitCost, supplier_id: supplierId,
      source: 'purchase_report', source_ref: refNo || null,
      effective_date: date, created_by: session.sub,
    });
    pricePoints++;

    const cur = newest.get(mat.id);
    if (!cur || date > cur.date) newest.set(mat.id, { date, price: unitCost, supplierId });
    const pk = mat.id + '|' + supplierId;
    const pc = pairSeen.get(pk);
    if (supplierId && (!pc || date > pc.date)) pairSeen.set(pk, { date, price: unitCost });
  }

  /* Batch insert price history. */
  for (let i = 0; i < priceRows.length; i += 500) {
    const { error } = await sb.from('qt_material_price_history').insert(priceRows.slice(i, i + 500));
    if (error) return json({ error: 'Price history insert failed: ' + error.message }, 500);
  }

  /* Update latest price per material from the newest purchase in file. */
  let materialsUpdated = 0;
  for (const [materialId, info] of newest) {
    const { error } = await sb.from('qt_materials')
      .update({ latest_price: info.price, default_supplier_id: info.supplierId || undefined, updated_by: session.sub, updated_at: new Date().toISOString() })
      .eq('id', materialId);
    if (!error) materialsUpdated++;
  }

  /* Maintain material↔supplier last-price map. */
  const pairRows = Array.from(pairSeen, ([k, v]) => {
    const [material_id, supplier_id] = k.split('|');
    return { material_id, supplier_id, last_price: v.price, last_purchase_at: v.date };
  }).filter(r => r.supplier_id && r.supplier_id !== 'null');
  for (let i = 0; i < pairRows.length; i += 500) {
    await sb.from('qt_material_suppliers').upsert(pairRows.slice(i, i + 500), { onConflict: 'material_id,supplier_id' });
  }

  const summary = { rowsRead, suppliersCreated, materialsCreated, materialsUpdated, pricePoints, skipped };
  await audit(sb, 'qt_materials', null, 'insert', null, { import: 'purchases', ...summary }, session.sub);
  return json(summary);
}
