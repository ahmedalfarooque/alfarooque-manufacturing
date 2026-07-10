'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { makeItemHandlers } = require('@/lib/crud');

const FIELDS = ['code', 'name', 'name_en', 'name_ar', 'category', 'sub_category', 'sub_category_en', 'sub_category_ar', 'sku', 'barcode',
  'description', 'description_en', 'description_ar', 'unit', 'standard_price', 'dimensions', 'images',
  'image_path', 'notes', 'tags', 'status', 'cost_params'];

const handlers = makeItemHandlers({ table: 'qt_catalogue_products', fields: FIELDS, required: ['name'], bilingual: ['name', 'description', 'sub_category'] });

/* GET returns the product together with its cost-model lines. */
export async function GET(req, { params }) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const sb = getDb();
  const { data: row, error } = await sb.from('qt_catalogue_products')
    .select('*').eq('id', params.id).is('deleted_at', null).single();
  if (error || !row) return json({ error: 'Not found' }, 404);
  const { data: lines } = await sb.from('qt_product_cost_lines')
    .select('*').eq('product_id', params.id).order('sort');
  return json({ row, lines: lines || [] });
}

export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
