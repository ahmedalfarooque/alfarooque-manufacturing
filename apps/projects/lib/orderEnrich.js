'use strict';

/* Order-item -> product enrichment, mirrors the Website Admin's
   api/_orderEnrich.js exactly (same join: match each item's name against
   public.products.name/name_ar, same productView shape) so the shared
   OrderDetailsModal component renders identical product cards in both
   apps from the identical underlying data. Import-only helper. */

const { imgUrl } = require('./imageUrl');

async function enrichOrderItems(sb, order) {
  if (!Array.isArray(order.items) || !order.items.length) return order;

  const [{ data: products }, { data: cats }] = await Promise.all([
    sb.from('products').select('id, name, name_ar, sku, description, description_ar, category_slug, images, material, sizes, sizes_ar, finishes, finishes_ar, specs, specs_ar, price'),
    sb.from('categories').select('slug, name, name_ar'),
  ]);
  const catName = {}, catNameAr = {};
  (cats || []).forEach(c => { catName[c.slug] = c.name; if (c.name_ar) catNameAr[c.slug] = c.name_ar; });
  const byName = {}, byId = {};
  (products || []).forEach(p => {
    if (p.name) byName[p.name] = p;
    if (p.name_ar) byName[p.name_ar] = p;
    byId[String(p.id)] = p;
  });

  /* Arabic columns ride along so the UI can display whichever language
     is currently selected — the stored order data stays untouched. */
  const productView = p => ({
    id: p.id, name: p.name, name_ar: p.name_ar || null, sku: p.sku || null,
    description: p.description || null, description_ar: p.description_ar || null,
    category: catName[p.category_slug] || p.category_slug || null,
    category_ar: catNameAr[p.category_slug] || null,
    images: (Array.isArray(p.images) ? p.images : []).map(imgUrl),
    material: p.material || null,
    sizes: Array.isArray(p.sizes) ? p.sizes : [],
    sizes_ar: Array.isArray(p.sizes_ar) ? p.sizes_ar : [],
    finishes: Array.isArray(p.finishes) ? p.finishes : [],
    finishes_ar: Array.isArray(p.finishes_ar) ? p.finishes_ar : [],
    specs: p.specs && typeof p.specs === 'object' ? p.specs : {},
    specs_ar: p.specs_ar && typeof p.specs_ar === 'object' ? p.specs_ar : {},
  });

  return Object.assign({}, order, {
    items: order.items.map(it => {
      const idKey = it.id != null ? String(it.id) : (it.product_id != null ? String(it.product_id) : null);
      const p = (idKey && byId[idKey]) || (it.name && byName[it.name]) || null;
      return p ? Object.assign({}, it, { product: productView(p) }) : it;
    }),
  });
}

module.exports = { enrichOrderItems };
