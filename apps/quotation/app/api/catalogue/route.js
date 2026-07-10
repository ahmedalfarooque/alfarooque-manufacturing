'use strict';

const { makeListHandler, makeCreateHandler } = require('@/lib/crud');

const FIELDS = ['code', 'name', 'name_en', 'name_ar', 'category', 'sub_category',
  'sub_category_en', 'sub_category_ar', 'sku', 'barcode',
  'description', 'description_en', 'description_ar', 'unit', 'standard_price',
  'dimensions', 'images', 'image_path', 'notes', 'tags', 'status', 'cost_params'];

export const GET = makeListHandler({
  table: 'qt_catalogue_products',
  searchCols: ['name', 'name_en', 'name_ar', 'code', 'category', 'sub_category', 'sku', 'barcode'],
  fields: FIELDS,
  defaultOrder: 'updated_at',
  filters: (q, params) => {
    const category = params.get('category');
    const sub = params.get('sub');
    const status = params.get('status');
    if (category) q = q.eq('category', category);
    if (sub) q = q.eq('sub_category', sub);
    q = status ? q.eq('status', status) : q.neq('status', 'archived');
    return q;
  },
});

export const POST = makeCreateHandler({
  table: 'qt_catalogue_products',
  fields: FIELDS,
  required: ['name'],
  bilingual: ['name', 'description', 'sub_category'],
  prepare: async (row, { sb }) => {
    if (!row.code) {
      /* Sequence-backed — IDs are never reused (schema v3). */
      const { data } = await sb.rpc('qt_next_product_code');
      row.code = data || ('P-' + Date.now());
    }
    return row;
  },
});
