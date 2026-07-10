'use strict';

/* Generic material-master import (template from
   /api/export/materials?template=1) — distinct from the Purchases
   Report importer. Upsert by code, else exact Arabic/English name.
   Price changes append qt_material_price_history (source 'import'). */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { parseUpload, col, toNum } = require('@/lib/sheets');
const { translate } = require('@/lib/translate');
const { parseDimField } = require('@/lib/dims');

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const parsed = await parseUpload(req);
  if (parsed.error) return json({ error: parsed.error }, 400);

  const sb = getDb();
  const { data: existing } = await sb.from('qt_materials').select('id, code, name, latest_price').is('deleted_at', null);
  const byCode = new Map((existing || []).map(m => [(m.code || '').trim().toUpperCase(), m]));
  const byName = new Map((existing || []).flatMap(m =>
    [[(m.name || '').trim(), m]].filter(([k]) => k)));

  let inserted = 0, updated = 0, failed = 0, priceChanges = 0;
  const errors = [];

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const rowNo = i + 2;
    const nameIn = col(r, ['name', 'material name', 'arabic name', 'english name', 'name ar', 'name en', 'الاسم', 'اسم المادة']);

    if (!nameIn) { failed++; errors.push(`Row ${rowNo}: missing material name`); continue; }

    const kindIn = (col(r, ['kind (material/hardware)', 'kind']) || 'material').toLowerCase();
    const price = toNum(col(r, ['price (sar)', 'price', 'latest price']));
    const row = {
      barcode: col(r, ['barcode']) || null,
      name: nameIn,

      kind: kindIn === 'hardware' ? 'hardware' : 'material',
      material_type: col(r, ['type', 'material type']) || null,
      unit: col(r, ['unit']) || 'piece',
      brand: col(r, ['brand']) || null,
      default_waste_pct: toNum(col(r, ['waste %', 'waste'])) || 0,
      notes: col(r, ['notes']) || null,
      status: 'active',
      updated_by: session.sub,
    };
    if (price != null) row.latest_price = price;

    for (const dim of ['height', 'width', 'length', 'thickness']) {
      const parsed = parseDimField(col(r, [dim]), col(r, [dim + ' unit']));
      if (parsed.value != null) { row[dim + '_value'] = parsed.value; row[dim + '_unit'] = parsed.unit; }
    }

    const codeIn = col(r, ['code']).trim().toUpperCase();
    const match = (codeIn && byCode.get(codeIn)) || byName.get(nameIn.trim()) || null;
    try {
      if (match) {
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
        row.code = codeIn || null;
        row.latest_price = price != null ? price : 0;
        row.created_by = session.sub;
        const { data: ins, error } = await sb.from('qt_materials').insert(row).select('id, code, name, latest_price').single();
        if (error) throw error;
        if (ins.code) byCode.set(ins.code.toUpperCase(), ins);
        byName.set(nameIn.trim(), ins);
        inserted++;
      }
    } catch (e) { failed++; errors.push(`Row ${rowNo}: ${e.message}`); }
  }

  await audit(sb, 'qt_materials', null, 'insert', null,
    { import: 'materials', inserted, updated, failed, priceChanges }, session.sub);
  return json({ inserted, updated, failed, priceChanges, errors: errors.slice(0, 50) });
}
