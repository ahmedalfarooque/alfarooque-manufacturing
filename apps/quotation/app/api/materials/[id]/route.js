'use strict';

const { makeItemHandlers } = require('@/lib/crud');

const FIELDS = ['code', 'barcode', 'name', 'name_en', 'name_ar', 'category_id', 'kind', 'material_type',
  'thickness', 'size_text', 'unit', 'brand', 'default_supplier_id', 'latest_price',
  'default_waste_pct', 'min_price', 'max_price', 'is_certified', 'cert_notes', 'notes', 'status',
  'height_value', 'height_unit', 'width_value', 'width_unit', 'length_value', 'length_unit',
  'thickness_value', 'thickness_unit'];

const handlers = makeItemHandlers({
  table: 'qt_materials',
  fields: FIELDS,
  bilingual: ['name'],
  /* Manual price edits append qt_material_price_history (FR-MAT-5). */
  afterUpdate: async ({ sb, session, before, after }) => {
    if (Number(before.latest_price) !== Number(after.latest_price)) {
      await sb.from('qt_material_price_history').insert({
        material_id: after.id,
        price: after.latest_price,
        previous_price: before.latest_price,
        supplier_id: after.default_supplier_id || null,
        source: 'manual',
        created_by: session.sub,
      });
    }
  },
});
export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
