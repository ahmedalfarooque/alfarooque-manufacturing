'use strict';

/* Generic material-master import — accepts either our own generated
   template (single "Material Name" column, "Kind (material/hardware)")
   or a real-world master list with separate "Name (EN)"/"Name (AR)"
   columns, a "Type" column that doubles as kind, a free-text "Category"
   column (auto-created in qt_material_categories), and abbreviated
   dimension-unit headers (H.Unit/W.Unit/L.Unit/T.Unit).
   Upsert by code, else by any known name (EN/AR/canonical).
   Price changes append qt_material_price_history (source 'import'). */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit, applyBilingual } = require('@/lib/crud');
const { parseUpload, col, toNum } = require('@/lib/sheets');
const { parseDimField } = require('@/lib/dims');

export const runtime = 'nodejs';
export const maxDuration = 300;

const DIM_UNIT_ALIASES = {
  height: ['height unit', 'h.unit', 'h unit'],
  width: ['width unit', 'w.unit', 'w unit'],
  length: ['length unit', 'l.unit', 'l unit'],
  thickness: ['thickness unit', 't.unit', 't unit'],
};

export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const parsed = await parseUpload(req);
  if (parsed.error) return json({ error: parsed.error }, 400);

  const sb = getDb();
  const { data: existing } = await sb.from('qt_materials')
    .select('id, code, name, name_en, name_ar, latest_price').is('deleted_at', null);
  const byCode = new Map((existing || []).map(m => [(m.code || '').trim().toUpperCase(), m]));
  const byName = new Map();
  for (const m of existing || []) {
    for (const n of [m.name, m.name_en, m.name_ar]) if (n && n.trim()) byName.set(n.trim(), m);
  }

  const { data: cats } = await sb.from('qt_material_categories').select('id, name, kind');
  const catMap = new Map((cats || []).map(c => [c.kind + '::' + c.name.trim().toLowerCase(), c.id]));
  let catSort = (cats || []).length;
  async function resolveCategory(nameRaw, kind) {
    const name = String(nameRaw || '').trim();
    if (!name) return null;
    const key = kind + '::' + name.toLowerCase();
    if (catMap.has(key)) return catMap.get(key);
    const { data, error } = await sb.from('qt_material_categories')
      .insert({ name, kind, sort: ++catSort }).select('id').single();
    if (error) return null;
    catMap.set(key, data.id);
    return data.id;
  }

  let inserted = 0, updated = 0, failed = 0, priceChanges = 0;
  const errors = [];

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const rowNo = i + 2;
    const nameEn = col(r, ['name (en)', 'name en', 'english name']);
    const nameAr = col(r, ['name (ar)', 'name ar', 'arabic name']);
    const nameGeneric = col(r, ['name', 'material name', 'اسم المادة', 'الاسم']);
    const nameIn = nameEn || nameAr || nameGeneric;
    if (!nameIn) { failed++; errors.push(`Row ${rowNo}: missing material name`); continue; }

    /* Kind: an explicit "Kind" column wins; otherwise the file's own
       "Type" column doubles as kind when it literally says
       Material(s)/Hardware (real-world export format) — else "Type" is
       treated as our template's material_type sub-classification. */
    const explicitKind = col(r, ['kind (material/hardware)', 'kind']).toLowerCase();
    const typeRaw = col(r, ['type']);
    const typeLower = typeRaw.toLowerCase();
    let kind = 'material', materialType = col(r, ['material type']) || null;
    if (explicitKind) kind = explicitKind === 'hardware' ? 'hardware' : 'material';
    else if (typeLower === 'hardware') kind = 'hardware';
    else if (typeLower === 'materials' || typeLower === 'material') kind = 'material';
    else if (typeRaw && !materialType) materialType = typeRaw;

    const categoryId = await resolveCategory(col(r, ['category']), kind);
    const price = toNum(col(r, ['price (sar)', 'price', 'latest price']));

    let row = {
      barcode: col(r, ['barcode']) || null,
      name_en: nameEn || null,
      name_ar: nameAr || null,
      name: nameEn || nameAr || nameGeneric,
      kind,
      material_type: materialType,
      category_id: categoryId,
      unit: col(r, ['unit']) || 'piece',
      brand: col(r, ['brand']) || null,
      default_waste_pct: toNum(col(r, ['waste %', 'waste'])) || 0,
      notes: col(r, ['notes']) || null,
      status: 'active',
      updated_by: session.sub,
    };
    for (const dim of ['height', 'width', 'length', 'thickness']) {
      const parsedDim = parseDimField(col(r, [dim]), col(r, DIM_UNIT_ALIASES[dim]));
      if (parsedDim.value != null) { row[dim + '_value'] = parsedDim.value; row[dim + '_unit'] = parsedDim.unit; }
    }
    if (price != null) row.latest_price = price;

    const codeIn = col(r, ['code']).trim().toUpperCase();
    const match = (codeIn && byCode.get(codeIn)) || byName.get(nameIn.trim()) || null;
    try {
      if (match) {
        row = applyBilingual(row, ['name'], match);
        const { error } = await sb.from('qt_materials')
          .update({ ...row, updated_at: new Date().toISOString() }).eq('id', match.id);
        if (error) throw error;
        updated++;
        if (price != null && Number(match.latest_price) !== price) {
          await sb.from('qt_material_price_history').insert({
            material_id: match.id, price, previous_price: match.latest_price,
            source: 'import', created_by: session.sub,
          });
          priceChanges++;
        }
      } else {
        row = applyBilingual(row, ['name'], null);
        row.code = codeIn || null;
        row.latest_price = price != null ? price : 0;
        row.created_by = session.sub;
        const { data: ins, error } = await sb.from('qt_materials')
          .insert(row).select('id, code, name, name_en, name_ar, latest_price').single();
        if (error) throw error;
        if (ins.code) byCode.set(ins.code.toUpperCase(), ins);
        for (const n of [ins.name, ins.name_en, ins.name_ar]) if (n && n.trim()) byName.set(n.trim(), ins);
        inserted++;
      }
    } catch (e) { failed++; errors.push(`Row ${rowNo}: ${e.message}`); }
  }

  await audit(sb, 'qt_materials', null, 'insert', null,
    { import: 'materials', inserted, updated, failed, priceChanges }, session.sub);
  return json({ inserted, updated, failed, priceChanges, errors: errors.slice(0, 50) });
}
