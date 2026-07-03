'use strict';

/* /api/admin/products
   GET    ?id=<id>                        → single product
   GET    ?page=&pageSize=&search=&category= → paginated list
   POST   { ...fields }                   → create
   PATCH  ?id=<id>  { ...fields }         → update
   DELETE ?id=<id>                        → delete */

const { getAdminClient } = require('../_supabaseAdmin');
const { requireAdminSession, readJsonBody, logAudit } = require('../_adminAuth');

const WRITABLE_FIELDS = [
  'id', 'category_slug', 'name', 'name_ar', 'description', 'description_ar', 'price', 'compare_at_price',
  'stock', 'low_stock_threshold', 'sku', 'material', 'availability', 'rating', 'review_count', 'badge',
  'is_featured', 'is_active', 'tags', 'images', 'videos', 'features', 'features_ar', 'specs', 'specs_ar',
  'applications', 'applications_ar', 'finishes', 'finishes_ar', 'sizes', 'sizes_ar',
  'warranty_label', 'warranty_label_ar', 'seo_title', 'seo_description',
];
function pickWritable(body) {
  const out = {};
  WRITABLE_FIELDS.forEach(k => { if (body[k] !== undefined) out[k] = body[k]; });
  return out;
}

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  const sb = getAdminClient();
  const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);

  if (req.method === 'GET') {
    if (query.id) {
      const { data, error } = await sb.from('products').select('*').eq('id', query.id).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Product not found.' });
      return res.status(200).json({ product: data });
    }
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));

    if (query.lowStock === '1') {
      /* stock <= low_stock_threshold is a column-to-column comparison,
         which PostgREST's filter API can't express directly — fetch and
         compare in JS (the catalog is small enough that this is fine). */
      const { data: all, error } = await sb.from('products').select('*').order('stock', { ascending: true }).limit(500);
      if (error) return res.status(500).json({ error: error.message });
      const filtered = (all || []).filter(p => p.stock <= (p.low_stock_threshold || 5));
      const from = (page - 1) * pageSize;
      return res.status(200).json({ products: filtered.slice(from, from + pageSize), total: filtered.length, page, pageSize });
    }

    const from = (page - 1) * pageSize, to = from + pageSize - 1;
    let q = sb.from('products').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (query.category && query.category !== 'all') q = q.eq('category_slug', query.category);
    if (query.search) q = q.or('name.ilike.%' + query.search.trim() + '%,name_ar.ilike.%' + query.search.trim() + '%,sku.ilike.%' + query.search.trim() + '%');
    const { data, error, count } = await q.range(from, to);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ products: data || [], total: count || 0, page, pageSize });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const fields = pickWritable(body);
    if (!fields.id || !fields.name) return res.status(400).json({ error: 'id and name are required.' });
    const { data, error } = await sb.from('products').insert(fields).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'product.create', entityType: 'product', entityId: data.id, req });
    return res.status(201).json({ product: data });
  }

  if (req.method === 'PATCH') {
    const id = query.id;
    if (!id) return res.status(400).json({ error: 'Missing product id.' });
    const body = await readJsonBody(req);
    const fields = pickWritable(body);
    delete fields.id; // primary key is not editable via PATCH
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'Nothing to update.' });
    const { data, error } = await sb.from('products').update(fields).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'product.update', entityType: 'product', entityId: id, details: fields, req });
    return res.status(200).json({ product: data });
  }

  if (req.method === 'DELETE') {
    const id = query.id;
    if (!id) return res.status(400).json({ error: 'Missing product id.' });
    const { error } = await sb.from('products').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'product.delete', entityType: 'product', entityId: id, req });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
