'use strict';

/* Distinct category/sub-category values actually present in the
   catalogue — the list page's filter dropdown uses this instead of a
   fixed enum, since catalogue.category/sub_category are free text
   (e.g. imported from an external product sheet) and don't necessarily
   match any hardcoded set. */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const sb = getDb();
  const { data, error } = await sb.from('qt_catalogue_products')
    .select('category, sub_category')
    .is('deleted_at', null).neq('status', 'archived');
  if (error) return json({ error: error.message }, 500);

  const categories = [...new Set((data || []).map(r => r.category).filter(Boolean))].sort();
  const subCategoriesByCategory = {};
  (data || []).forEach(r => {
    if (!r.category || !r.sub_category) return;
    const set = subCategoriesByCategory[r.category] || (subCategoriesByCategory[r.category] = new Set());
    set.add(r.sub_category);
  });
  Object.keys(subCategoriesByCategory).forEach(k => { subCategoriesByCategory[k] = [...subCategoriesByCategory[k]].sort(); });

  return json({ categories, subCategoriesByCategory });
}
