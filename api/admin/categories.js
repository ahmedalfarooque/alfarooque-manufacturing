'use strict';

/* /api/admin/categories
   GET    → full list (nested-ready via parent_id)
   POST   { slug, name, name_ar?, parent_id?, icon?, image_url?, sort_order? } → create
   PATCH  ?id=<uuid>  { ...fields }  → update
   DELETE ?id=<uuid>                 → delete */

const { getAdminClient } = require('../_supabaseAdmin');
const { requireAdminSession, readJsonBody, logAudit } = require('../_adminAuth');

const WRITABLE = ['slug', 'name', 'name_ar', 'parent_id', 'icon', 'image_url', 'sort_order', 'is_active'];
function pick(body) { const o = {}; WRITABLE.forEach(k => { if (body[k] !== undefined) o[k] = body[k]; }); return o; }

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  const sb = getAdminClient();
  const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);

  if (req.method === 'GET') {
    const { data, error } = await sb.from('categories').select('*').order('sort_order', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ categories: data || [] });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const fields = pick(body);
    if (!fields.slug || !fields.name) return res.status(400).json({ error: 'slug and name are required.' });
    const { data, error } = await sb.from('categories').insert(fields).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'category.create', entityType: 'category', entityId: data.id, req });
    return res.status(201).json({ category: data });
  }

  if (req.method === 'PATCH') {
    const id = query.id;
    if (!id) return res.status(400).json({ error: 'Missing category id.' });
    const fields = pick(await readJsonBody(req));
    if (!Object.keys(fields).length) return res.status(400).json({ error: 'Nothing to update.' });
    const { data, error } = await sb.from('categories').update(fields).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'category.update', entityType: 'category', entityId: id, details: fields, req });
    return res.status(200).json({ category: data });
  }

  if (req.method === 'DELETE') {
    const id = query.id;
    if (!id) return res.status(400).json({ error: 'Missing category id.' });
    const { error } = await sb.from('categories').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'category.delete', entityType: 'category', entityId: id, req });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
