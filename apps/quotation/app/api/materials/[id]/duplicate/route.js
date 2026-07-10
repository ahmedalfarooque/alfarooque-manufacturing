'use strict';

const { makeDuplicateHandler } = require('@/lib/crud');

const FIELDS = ['code', 'barcode', 'name', 'name_en', 'name_ar', 'category_id', 'kind', 'material_type',
  'thickness', 'size_text', 'unit', 'brand', 'default_supplier_id', 'latest_price',
  'default_waste_pct', 'min_price', 'max_price', 'is_certified', 'cert_notes', 'notes', 'status'];

export const POST = makeDuplicateHandler({
  table: 'qt_materials',
  fields: FIELDS,
  prepareCopy: async (copy, { sb }) => {
    const { count } = await sb.from('qt_materials').select('id', { count: 'exact', head: true });
    copy.code = (copy.kind === 'hardware' ? 'H-' : 'M-') + String((count || 0) + 1).padStart(5, '0');
    if (copy.name) copy.name = copy.name + ' (copy)';
    if (copy.name_en) copy.name_en = copy.name_en + ' (copy)';
    if (copy.name_ar) copy.name_ar = copy.name_ar + ' (نسخة)';
    return copy;
  },
});
