'use strict';

/* /api/admin/orders/deleted — GET only. The ONLY endpoint in the app
   that queries is_deleted = true. This is an archive view, not a
   second Orders list: it has its own search/filters and does not
   share pagination state or query shape with /api/admin/orders.
   GET ?page=&pageSize=&search=&status=&deletedBy=&dateFrom=&dateTo=&recovery= */

const { getAdminClient } = require('../../_supabaseAdmin');
const { requireAdminSession } = require('../../_adminAuth');
const { attachCustomerInfo, attachDeletedByInfo, daysRemaining, sendOrdersError, hasSoftDelete } = require('../../_ordersCore');

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const sb = getAdminClient();
  const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 15));

  /* This page has nothing to show at all until the migration exists —
     the client renders "feature not enabled yet" rather than an empty
     table, driven by softDeleteEnabled: false. */
  if (!(await hasSoftDelete(sb))) {
    return res.status(200).json({ orders: [], total: 0, page, pageSize, softDeleteEnabled: false });
  }

  const from = (page - 1) * pageSize, to = from + pageSize - 1;

  let q = sb.from('orders')
    .select('id, order_no, status, payment_status, grand_total, created_at, guest_name, guest_email, user_id, deleted_at, deleted_by, auto_delete_at', { count: 'exact' })
    .eq('is_deleted', true)
    .order('deleted_at', { ascending: false });

  if (query.search) {
    const s = query.search.trim();
    q = q.or('order_no.ilike.%' + s + '%,guest_name.ilike.%' + s + '%,guest_email.ilike.%' + s + '%');
  }
  if (query.status && query.status !== 'all') q = q.eq('status', query.status);
  if (query.deletedBy) q = q.eq('deleted_by', query.deletedBy);
  if (query.dateFrom) q = q.gte('deleted_at', new Date(query.dateFrom).toISOString());
  if (query.dateTo) {
    const end = new Date(query.dateTo); end.setHours(23, 59, 59, 999);
    q = q.lte('deleted_at', end.toISOString());
  }

  const { data, error, count } = await q.range(from, to);
  if (error) return sendOrdersError(res, error);

  let orders = await attachCustomerInfo(sb, data || []);
  orders = await attachDeletedByInfo(sb, orders);
  orders = orders.map(o => Object.assign({}, o, { days_remaining: daysRemaining(o) }));

  /* Recovery-remaining filter applied after computing days_remaining —
     green/orange/red buckets match the badge thresholds in
     js/admin/dashboard.js's recoveryBadge(). */
  if (query.recovery && query.recovery !== 'all') {
    orders = orders.filter(o => {
      if (query.recovery === 'green') return o.days_remaining > 14;
      if (query.recovery === 'orange') return o.days_remaining > 3 && o.days_remaining <= 14;
      if (query.recovery === 'red') return o.days_remaining <= 3;
      return true;
    });
  }

  return res.status(200).json({ orders, total: count || 0, page, pageSize, softDeleteEnabled: true });
};
