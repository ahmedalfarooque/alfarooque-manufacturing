'use strict';

/* GET /api/products
   Public, read-only catalog endpoint — the SINGLE source of truth for
   product data on the public site. Reads the exact same public.products
   table the Admin Dashboard writes to (api/admin/products.js), so any
   admin edit (price, stock, images, description, etc.) is live on the
   public site immediately, with no separate static/seed data anywhere.

   Only returns is_active = true rows, mirroring the "public read
   products" RLS policy already defined in supabase/schema.sql — enforced
   here explicitly since this reads via the service-role client (bypasses
   RLS), the same pattern already used by api/quote.js for public writes. */

const { getAdminClient } = require('./_supabaseAdmin');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  /* Never cache — an admin price/stock edit must be visible on next
     load, not after a stale window expires (see api/admin/products.js
     for where writes happen; there is no other cache layer to invalidate
     since this response is never cached in the first place). */
  res.setHeader('Cache-Control', 'no-store');

  try {
    const sb = getAdminClient();
    const { data, error } = await sb
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('id', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ products: (data || []).map(toPublicShape) });
  } catch (err) {
    console.error('[api/products] Failed:', err.message);
    return res.status(500).json({ error: 'Could not load products.' });
  }
};

/* Translate DB column names to the exact object shape js/products.js has
   always rendered (cat, nameAr, desc, imgs, warrantyLabel, etc.) — so the
   card/modal/filter/cart rendering code needs zero changes, only its data
   source changes. */
function toPublicShape(row) {
  const images = Array.isArray(row.images) ? row.images : [];
  return {
    id: row.id,
    cat: row.category_slug,
    material: row.material || '',
    availability: row.availability || 'In Stock',
    rating: Number(row.rating) || 0,
    reviewCount: row.review_count || 0,
    badge: row.badge || undefined,
    featured: !!row.is_featured,
    tags: row.tags || [],
    name: row.name,
    nameAr: row.name_ar || row.name,
    desc: row.description || '',
    descAr: row.description_ar || row.description || '',
    price: Number(row.price) || 0,
    oldPrice: row.compare_at_price != null ? Number(row.compare_at_price) : undefined,
    img: images[0] || '',
    imgs: images,
    warrantyLabel: row.warranty_label || '',
    warrantyLabelAr: row.warranty_label_ar || row.warranty_label || '',
    features: row.features || [],
    featuresAr: row.features_ar || [],
    specs: row.specs || {},
    specsAr: row.specs_ar || {},
    applications: row.applications || [],
    applicationsAr: row.applications_ar || [],
    finishes: row.finishes || [],
    finishesAr: row.finishes_ar || [],
    sizes: row.sizes || [],
    sizesAr: row.sizes_ar || row.sizes || [],
  };
}
