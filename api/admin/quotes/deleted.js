'use strict';

/* /api/admin/quotes/deleted — GET only. The ONLY endpoint that queries
   quotes.is_deleted = true. Own search/filters, not shared with
   /api/admin/quotes. Mirrors api/admin/orders/deleted.js exactly.
   GET ?page=&pageSize=&search=&status=&deletedBy=&dateFrom=&dateTo=&recovery= */

const { getAdminClient } = require('../../_supabaseAdmin');
const { requireAdminSession } = require('../../_adminAuth');
const { attachDeletedByInfo, daysRemaining, sendQuotesError, hasSoftDelete } = require('../../_quotesCore');

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const sb = getAdminClient();
  const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 15));

  if (!(await hasSoftDelete(sb))) {
    return res.status(200).json({ quotes: [], total: 0, page, pageSize, softDeleteEnabled: false });
  }

  const from = (page - 1) * pageSize, to = from + pageSize - 1;

  let q = sb.from('quotes')
    .select('id, name, email, phone, product, status, created_at, deleted_at, deleted_by, auto_delete_at', { count: 'exact' })
    .eq('is_deleted', true)
    .order('deleted_at', { ascending: false });

  if (query.search) {
    const s = query.search.trim();
    q = q.or('name.ilike.%' + s + '%,email.ilike.%' + s + '%,product.ilike.%' + s + '%');
  }
  if (query.status && query.status !== 'all') q = q.eq('status', query.status);
  if (query.deletedBy) q = q.eq('deleted_by', query.deletedBy);
  if (query.dateFrom) q = q.gte('deleted_at', new Date(query.dateFrom).toISOString());
  if (query.dateTo) {
    const end = new Date(query.dateTo); end.setHours(23, 59, 59, 999);
    q = q.lte('deleted_at', end.toISOString());
  }

  const { data, error, count } = await q.range(from, to);
  if (error) return sendQuotesError(res, error);

  let quotes = await attachDeletedByInfo(sb, data || []);
  quotes = quotes.map(qt => Object.assign({}, qt, { days_remaining: daysRemaining(qt) }));

  if (query.recovery && query.recovery !== 'all') {
    quotes = quotes.filter(qt => {
      if (query.recovery === 'green') return qt.days_remaining > 14;
      if (query.recovery === 'orange') return qt.days_remaining > 3 && qt.days_remaining <= 14;
      if (query.recovery === 'red') return qt.days_remaining <= 3;
      return true;
    });
  }

  return res.status(200).json({ quotes, total: count || 0, page, pageSize, softDeleteEnabled: true });
};
