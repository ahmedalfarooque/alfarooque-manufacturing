'use strict';

/* GET /api/admin/dashboard-stats — live counts + recent activity for the Dashboard Home. */

const { getAdminClient } = require('../_supabaseAdmin');
const { requireAdminSession } = require('../_adminAuth');
const { sendOrdersError, hasSoftDelete } = require('../_ordersCore');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const admin = await requireAdminSession(req, res);
  if (!admin) return;

  const sb = getAdminClient();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const softDeleteEnabled = await hasSoftDelete(sb);

  let ordersQuery = sb.from('orders').select('id, order_no, status, grand_total, created_at, guest_name, user_id').order('created_at', { ascending: false }).limit(500);
  if (softDeleteEnabled) ordersQuery = ordersQuery.eq('is_deleted', false);

  const [ordersRes, quotesRes, productsRes, lowStockRes, customerCountRes, recentProfilesRes] = await Promise.all([
    ordersQuery,
    sb.from('quotes').select('id, status, created_at').order('created_at', { ascending: false }).limit(500),
    sb.from('products').select('id', { count: 'exact', head: true }),
    sb.from('products').select('id, name, stock, low_stock_threshold').order('stock', { ascending: true }).limit(200),
    sb.from('profiles').select('id', { count: 'exact', head: true }),
    sb.from('profiles').select('id, first_name, last_name, full_name, created_at').order('created_at', { ascending: false }).limit(5),
  ]);
  /* Any remaining error here is a genuine, non-migration problem — the
     softDeleteEnabled branch above already avoided querying a column
     that might not exist. */
  if (ordersRes.error) return sendOrdersError(res, ordersRes.error);

  const orders = ordersRes.data || [];
  const quotes = quotesRes.data || [];
  const lowStockAll = (lowStockRes.data || []).filter(p => p.stock <= (p.low_stock_threshold || 5));
  const customerCount = customerCountRes.count;
  const recentProfiles = recentProfilesRes.data;

  const todayOrders = orders.filter(o => new Date(o.created_at) >= todayStart);
  const byStatus = st => orders.filter(o => (o.status || '').toLowerCase() === st).length;
  const revenue = orders.filter(o => (o.status || '').toLowerCase() === 'completed')
    .reduce((s, o) => s + (Number(o.grand_total) || 0), 0);
  const todayRevenue = todayOrders.reduce((s, o) => s + (Number(o.grand_total) || 0), 0);

  /* Recent customers: latest profiles, merged with auth email — one batched
     listUsers() call instead of a getUserById() round-trip per customer
     (was 5 sequential requests for the 5 most recent customers). */
  const { data: recentUsersPage } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailById = {};
  (recentUsersPage && recentUsersPage.users || []).forEach(u => { emailById[u.id] = u.email || ''; });
  const recentCustomers = (recentProfiles || []).map(p => {
    const email = emailById[p.id] || '';
    return { id: p.id, name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || email, email, created_at: p.created_at };
  });

  /* Resolve real names for the recent orders placed by signed-in customers */
  const recentOrdersRaw = orders.slice(0, 8);
  const recentUserIds = Array.from(new Set(recentOrdersRaw.filter(o => o.user_id).map(o => o.user_id)));
  const recentNameMap = {};
  if (recentUserIds.length) {
    const { data: recentOwnerProfiles } = await sb.from('profiles')
      .select('id, first_name, last_name, full_name').in('id', recentUserIds);
    (recentOwnerProfiles || []).forEach(p => {
      recentNameMap[p.id] = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Registered customer';
    });
  }

  return res.status(200).json({
    todayOrders: todayOrders.length,
    pending: byStatus('pending'),
    processing: byStatus('processing'),
    completed: byStatus('completed'),
    cancelled: byStatus('cancelled'),
    revenue,
    todayRevenue,
    totalOrders: orders.length,
    quotesTotal: quotes.length,
    quotesNew: quotes.filter(q => q.status === 'new').length,
    productsTotal: productsRes.count || 0,
    customersTotal: customerCount || 0,
    lowStockCount: lowStockAll.length,
    lowStock: lowStockAll.slice(0, 8),
    recentOrders: recentOrdersRaw.map(o => ({
      id: o.id, order_no: o.order_no, status: o.status, grand_total: o.grand_total,
      created_at: o.created_at,
      customer: o.guest_name || (o.user_id ? (recentNameMap[o.user_id] || 'Registered customer') : 'Guest'),
    })),
    recentCustomers,
    softDeleteEnabled,
  });
};
