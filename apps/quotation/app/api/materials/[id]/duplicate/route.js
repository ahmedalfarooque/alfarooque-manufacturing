'use strict';

const { makeDuplicateHandler } = require('@/lib/crud');

const FIELDS = ['code', 'barcode', 'name', 'name_en', 'name_ar', 'category_id', 'kind', 'material_type',
  'thickness', 'size_text', 'unit', 'brand', 'default_supplier_id', 'latest_price',
  'default_waste_pct', 'min_price', 'max_price', 'is_certified', 'cert_notes', 'notes', 'status',
  'height_value', 'height_unit', 'width_value', 'width_unit', 'length_value', 'length_unit',
  'thickness_value', 'thickness_unit'];

export const POST = makeDuplicateHandler({
  table: 'qt_materials',
  fields: FIELDS,
  prepareCopy: async (copy, { sb }) => {
    /* Highest existing auto code (not table count) — collision-safe. */
    const prefix = copy.kind === 'hardware' ? 'H-' : 'M-';
    const { data } = await sb.from('qt_materials').select('code')
      .like('code', prefix + '%').order('code', { ascending: false }).limit(1);
    const last = data && data[0] ? parseInt(String(data[0].code).slice(prefix.length), 10) || 0 : 0;
    copy.code = prefix + String(last + 1).padStart(5, '0');
    copy.barcode = copy.code;
    if (copy.name) copy.name = copy.name + ' (copy)';
    if (copy.name_en) copy.name_en = copy.name_en + ' (copy)';
    if (copy.name_ar) copy.name_ar = copy.name_ar + ' (نسخة)';
    return copy;
  },
});
