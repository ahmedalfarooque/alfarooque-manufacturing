'use strict';

/* GET /api/categories
   Public, read-only endpoint — reads the same public.categories table
   the Admin Dashboard's Categories module writes to (api/admin/
   categories.js). Renaming/reordering a category in the admin is live
   on the public site immediately, with no separate hardcoded label map. */

const { getAdminClient } = require('./_supabaseAdmin');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  try {
    const sb = getAdminClient();
    const { data, error } = await sb
      .from('categories')
      .select('slug, name, name_ar, image_url, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ categories: data || [] });
  } catch (err) {
    console.error('[api/categories] Failed:', err.message);
    return res.status(500).json({ error: 'Could not load categories.' });
  }
};
