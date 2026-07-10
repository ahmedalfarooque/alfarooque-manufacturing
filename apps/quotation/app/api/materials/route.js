'use strict';

const { makeListHandler, makeCreateHandler } = require('@/lib/crud');

const FIELDS = ['code', 'barcode', 'name', 'name_en', 'name_ar', 'category_id', 'kind', 'material_type',
  'thickness', 'size_text', 'unit', 'brand', 'default_supplier_id', 'latest_price',
  'default_waste_pct', 'min_price', 'max_price', 'is_certified', 'cert_notes', 'notes', 'status'];

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
      /* Auto code: M-00001 / H-00001 style, based on table count. */
      const { count } = await sb.from('qt_materials').select('id', { count: 'exact', head: true });
      row.code = (row.kind === 'hardware' ? 'H-' : 'M-') + String((count || 0) + 1).padStart(5, '0');
    }
    return row;
  },
});
