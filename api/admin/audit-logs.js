'use strict';

/* GET /api/admin/audit-logs?page=&pageSize=&search= — who did what, when, from where. */

const { getAdminClient } = require('../_supabaseAdmin');
const { requireAdminSession } = require('../_adminAuth');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  const sb = getAdminClient();
  const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(query.pageSize, 10) || 50));
  const from = (page - 1) * pageSize, to = from + pageSize - 1;

  let q = sb.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (query.search) {
    const s = query.search.trim();
    q = q.or('admin_email.ilike.%' + s + '%,action.ilike.%' + s + '%,entity_type.ilike.%' + s + '%');
  }
  const { data, error, count } = await q.range(from, to);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ logs: data || [], total: count || 0, page, pageSize });
};
