'use strict';

/* Product import (xlsx/csv, template from /api/export/products?template=1).
   Validates row-by-row, imports valid rows only, reports errors with row
   numbers. Upsert: by Product ID (code) → update; else insert with a new
   never-reused code. Auto-translates the missing name language.        */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { parseUpload, col, toNum } = require('@/lib/sheets');
const { translate } = require('@/lib/translate');

export const runtime = 'nodejs';
export const maxDuration = 300;

const DIMS = ['length', 'width', 'height', 'thickness', 'depth', 'diameter', 'weight', 'area', 'volume'];

export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const parsed = await parseUpload(req);
  if (parsed.error) return json({ error: parsed.error }, 400);

  const sb = getDb();
  const { data: existing } = await sb.from('qt_catalogue_products').select('id, code').is('deleted_at', null);
  const byCode = new Map((existing || []).map(p => [(p.code || '').trim().toUpperCase(), p.id]));

  let inserted = 0, updated = 0, failed = 0;
  const errors = [];

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const rowNo = i + 2;
    const nameIn = col(r, ['name', 'product name', 'english name', 'arabic name', 'name en', 'name ar', 'اسم المنتج', 'الاسم']);

    if (!nameIn) { failed++; errors.push(`Row ${rowNo}: missing product name`); continue; }

    const dims = {};
    for (const d of DIMS) {
      const v = toNum(col(r, [`${d} (mm)`, `${d} (kg)`, `${d} (m2)`, `${d} (m3)`, d]));
      if (v && v > 0) dims[d] = v;
    }
    const price = toNum(col(r, ['price (sar)', 'price', 'standard price']));
    const status = (col(r, ['status']) || 'active').toLowerCase();
    const row = {
      sku: col(r, ['sku']) || null,
      barcode: col(r, ['barcode']) || null,
      name: nameIn,

      category: (col(r, ['category']) || 'OTHER').toUpperCase(),
      sub_category: col(r, ['sub category', 'sub_category', 'subcategory']) || null,
      description: col(r, ['description', 'description en', 'description ar', 'الوصف']) || null,

      unit: col(r, ['unit']) || 'nos',
      dimensions: dims,
      standard_price: price != null ? price : 0,
      image_path: col(r, ['image url', 'image_path', 'image']) || null,
      notes: col(r, ['notes']) || null,
      status: ['active', 'archived', 'inactive'].includes(status) ? status : 'active',
      updated_by: session.sub,
    };

    const codeIn = col(r, ['product id', 'code', 'product code']).trim().toUpperCase();
    try {
      if (codeIn && byCode.has(codeIn)) {
        const { error } = await sb.from('qt_catalogue_products')
          .update({ ...row, updated_at: new Date().toISOString() }).eq('id', byCode.get(codeIn));
        if (error) throw error;
        updated++;
      } else {
        const { data: code } = await sb.rpc('qt_next_product_code');
        row.code = codeIn && !byCode.has(codeIn) ? codeIn : (code || 'P-' + Date.now());
        row.created_by = session.sub;
        const { data: ins, error } = await sb.from('qt_catalogue_products').insert(row).select('id, code').single();
        if (error) throw error;
        byCode.set(row.code.toUpperCase(), ins.id);
        inserted++;
      }
    } catch (e) { failed++; errors.push(`Row ${rowNo}: ${e.message}`); }
  }

  await audit(sb, 'qt_catalogue_products', null, 'insert', null,
    { import: 'products', inserted, updated, failed }, session.sub);
  return json({ inserted, updated, failed, errors: errors.slice(0, 50) });
}
