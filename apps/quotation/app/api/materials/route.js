'use strict';

const { makeListHandler, makeCreateHandler } = require('@/lib/crud');

const FIELDS = ['code', 'barcode', 'name', 'name_en', 'name_ar', 'category_id', 'kind', 'material_type',
  'thickness', 'size_text', 'unit', 'brand', 'default_supplier_id', 'latest_price',
  'default_waste_pct', 'min_price', 'max_price', 'is_certified', 'cert_notes', 'notes', 'status',
  'height_value', 'height_unit', 'width_value', 'width_unit', 'length_value', 'length_unit',
  'thickness_value', 'thickness_unit'];

export const GET = makeListHandler({
  table: 'qt_materials',
  searchCols: ['name', 'name_en', 'name_ar', 'code', 'barcode', 'brand'],
  fields: FIELDS,
  defaultOrder: 'updated_at',
  filters: (q, params) => {
    const kind = params.get('kind');
    const category = params.get('category');
    if (kind) q = q.eq('kind', kind);
    if (category) q = q.eq('category_id', category);
    return q;
  },
});

export const POST = makeCreateHandler({
  table: 'qt_materials',
  fields: FIELDS,
  required: ['name'],
  bilingual: ['name'],
  prepare: async (row, { sb }) => {
    if (!row.code) {
      /* Auto code: M-00001 / H-00001 style. Based on the highest existing
         auto code (not table count) so it never collides after deletes. */
      const prefix = row.kind === 'hardware' ? 'H-' : 'M-';
      const { data } = await sb.from('qt_materials').select('code')
        .like('code', prefix + '%').order('code', { ascending: false }).limit(1);
      const last = data && data[0] ? parseInt(String(data[0].code).slice(prefix.length), 10) || 0 : 0;
      row.code = prefix + String(last + 1).padStart(5, '0');
      /* Convention: barcode mirrors the code when not supplied
         (matches the master-list import and Save-as-New). */
      if (!row.barcode) row.barcode = row.code;
    }
    return row;
  },
});
