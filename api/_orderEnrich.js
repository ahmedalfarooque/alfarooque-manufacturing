'use strict';

/* ═══════════════════════════════════════════════════════════════════
   Order-item → product enrichment (import-only helper, not routed).

   Order rows store items as lightweight snapshots: { name, qty, price }.
   They carry no product id — customer orders save the display-language
   name (English OR Arabic), guest orders the same. To show images,
   descriptions, materials, sizes etc. in the admin's read-only views,
   we join each item back to public.products by exact name match against
   BOTH name columns, falling back to id/product_id when a future item
   format includes one. Items that no longer match any product (deleted/
   renamed) are returned unchanged — the caller renders them without a
   product block rather than failing.
   ═══════════════════════════════════════════════════════════════════ */

async function enrichOrderItems(sb, orders) {
  const wantsLookup = orders.some(o => Array.isArray(o.items) && o.items.length);
  if (!wantsLookup) return orders;

  const [{ data: products }, { data: cats }] = await Promise.all([
    sb.from('products').select('id, name, name_ar, sku, description, description_ar, category_slug, images, material, sizes, finishes, specs, price'),
    sb.from('categories').select('slug, name'),
  ]);
  const catName = {};
  (cats || []).forEach(c => { catName[c.slug] = c.name; });
  const byName = {}, byId = {};
  (products || []).forEach(p => {
    if (p.name) byName[p.name] = p;
    if (p.name_ar) byName[p.name_ar] = p;
    byId[String(p.id)] = p;
  });

  const productView = p => ({
    id: p.id,
    name: p.name,
    sku: p.sku || null,
    description: p.description || null,
    category: catName[p.category_slug] || p.category_slug || null,
    images: Array.isArray(p.images) ? p.images : [],
    material: p.material || null,
    sizes: Array.isArray(p.sizes) ? p.sizes : [],
    finishes: Array.isArray(p.finishes) ? p.finishes : [],
    specs: p.specs && typeof p.specs === 'object' ? p.specs : {},
  });

  return orders.map(o => {
    if (!Array.isArray(o.items) || !o.items.length) return o;
    return Object.assign({}, o, {
      items: o.items.map(it => {
        const idKey = it.id != null ? String(it.id) : (it.product_id != null ? String(it.product_id) : null);
        const p = (idKey && byId[idKey]) || (it.name && byName[it.name]) || null;
        return p ? Object.assign({}, it, { product: productView(p) }) : it;
      }),
    });
  });
}

module.exports = { enrichOrderItems };
