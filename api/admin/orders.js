'use strict';

/* /api/admin/orders
   GET   ?id=<uuid>              → single order
   GET   ?page=&pageSize=&status=&search=  → paginated list
   PATCH ?id=<uuid>  { status?, payment_status?, current_stage?,
                        estimated_completion?, estimated_delivery?,
                        tracking_pct?, admin_notes? }
   Every write lands directly in public.orders — the same table the
   customer dashboard reads live, so status/tracking changes are visible
   to the customer the next time their dashboard loads or re-syncs. */

const { getAdminClient } = require('../_supabaseAdmin');
const { requireAdminSession, readJsonBody, logAudit } = require('../_adminAuth');

const ALLOWED_STATUSES = [
  'pending', 'confirmed', 'processing', 'manufacturing', 'quality_check', 'packed',
  'ready', 'shipped', 'out_for_delivery', 'delivered', 'completed', 'cancelled', 'returned', 'rejected',
];
const ALLOWED_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

/* Attach the real name/email for orders placed by a signed-in customer
   (guest orders already carry guest_name/guest_email on the row itself). */
async function attachCustomerInfo(sb, orders) {
  const ids = Array.from(new Set(orders.filter(o => o.user_id).map(o => o.user_id)));
  if (!ids.length) return orders;

  const [{ data: profiles }, { data: usersPage }] = await Promise.all([
    sb.from('profiles').select('id, first_name, last_name, full_name').in('id', ids),
    sb.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  const profileMap = {};
  (profiles || []).forEach(p => { profileMap[p.id] = p; });
  const emailMap = {};
  (usersPage && usersPage.users || []).forEach(u => { emailMap[u.id] = u.email; });

  return orders.map(o => {
    if (!o.user_id) return o;
    const p = profileMap[o.user_id] || {};
    return Object.assign({}, o, {
      customer_name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || emailMap[o.user_id] || 'Registered customer',
      customer_email: emailMap[o.user_id] || '',
    });
  });
}

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  const sb = getAdminClient();
  const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);

  if (req.method === 'GET') {
    if (query.id) {
      const { data, error } = await sb.from('orders').select('*').eq('id', query.id).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Order not found.' });
      const [withInfo] = await attachCustomerInfo(sb, [data]);
      return res.status(200).json({ order: withInfo });
    }

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const from = (page - 1) * pageSize, to = from + pageSize - 1;

    let q = sb.from('orders').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (query.status && query.status !== 'all') q = q.eq('status', query.status);
    if (query.today === '1') {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      q = q.gte('created_at', startOfDay.toISOString());
    }
    if (query.search) {
      const s = query.search.trim();
      q = q.or('order_no.ilike.%' + s + '%,guest_name.ilike.%' + s + '%,guest_email.ilike.%' + s + '%');
    }
    const { data, error, count } = await q.range(from, to);
    if (error) return res.status(500).json({ error: error.message });
    const withInfo = await attachCustomerInfo(sb, data || []);
    return res.status(200).json({ orders: withInfo, total: count || 0, page, pageSize });
  }

  if (req.method === 'PATCH') {
    const id = query.id;
    if (!id) return res.status(400).json({ error: 'Missing order id.' });
    const body = await readJsonBody(req);

    const { data: existing } = await sb.from('orders').select('*').eq('id', id).maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Order not found.' });

    const patch = {};
    if (body.status !== undefined) {
      if (!ALLOWED_STATUSES.includes(body.status)) return res.status(400).json({ error: 'Invalid status.' });
      patch.status = body.status;
    }
    if (body.payment_status !== undefined) {
      if (!ALLOWED_PAYMENT_STATUSES.includes(body.payment_status)) return res.status(400).json({ error: 'Invalid payment status.' });
      patch.payment_status = body.payment_status;
    }
    if (body.current_stage !== undefined) patch.current_stage = body.current_stage;
    if (body.estimated_completion !== undefined) patch.estimated_completion = body.estimated_completion || null;
    if (body.estimated_delivery !== undefined) patch.estimated_delivery = body.estimated_delivery || null;
    if (body.tracking_pct !== undefined) patch.tracking_pct = Math.max(0, Math.min(100, Number(body.tracking_pct) || 0));
    if (body.admin_notes !== undefined) patch.admin_notes = String(body.admin_notes || '').slice(0, 2000);

    if (patch.status && patch.status !== existing.status) {
      const timeline = Array.isArray(existing.timeline) ? existing.timeline.slice() : [];
      timeline.push({ status: patch.status, at: new Date().toISOString(), note: body.note || null });
      patch.timeline = timeline;
    }

    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update.' });

    const { data, error } = await sb.from('orders').update(patch).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });

    await logAudit(sb, {
      adminId: admin.id, adminEmail: admin.email, action: 'order.update',
      entityType: 'order', entityId: id, details: patch, req,
    });

    /* Live notification for the admin feed */
    if (patch.status) {
      await sb.from('admin_notifications').insert({
        type: 'order', title: 'Order ' + (existing.order_no || id.slice(0, 8)) + ' updated',
        body: 'Status changed to ' + patch.status, link: '/pages/admin/dashboard.html#orders',
      });
    }

    return res.status(200).json({ order: data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
