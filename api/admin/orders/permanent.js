'use strict';

/* /api/admin/orders/permanent — DELETE ?id=<uuid> → real, irreversible
   DB delete. Super Admin only (admin_users.role === 'admin'), enforced
   server-side — the button that calls this is already hidden for any
   other role in js/admin/dashboard.js, but that's a UI convenience,
   not the security boundary. Only a row already soft-deleted can be
   hit by this endpoint. */

const { getAdminClient } = require('../../_supabaseAdmin');
const { requireAdminSession, logAudit } = require('../../_adminAuth');
const { isSuperAdmin, sendOrdersError, hasSoftDelete } = require('../../_ordersCore');

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  if (!isSuperAdmin(admin)) return res.status(403).json({ error: 'Only a Super Admin can permanently delete an order.' });

  const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const id = query.id;
  if (!id) return res.status(400).json({ error: 'Missing order id.' });

  const sb = getAdminClient();
  if (!(await hasSoftDelete(sb))) return res.status(409).json({ error: 'Soft Delete feature has not been enabled yet.', softDeleteEnabled: false });

  const { data: existing, error: fetchError } = await sb.from('orders').select('id, order_no, is_deleted').eq('id', id).maybeSingle();
  if (fetchError) return sendOrdersError(res, fetchError);
  if (!existing) return res.status(404).json({ error: 'Order not found.' });
  if (!existing.is_deleted) return res.status(400).json({ error: 'Only a soft-deleted order can be permanently deleted.' });

  const { error } = await sb.from('orders').delete().eq('id', id);
  if (error) return sendOrdersError(res, error);

  await logAudit(sb, {
    adminId: admin.id, adminEmail: admin.email, action: 'order.permanent_delete',
    entityType: 'order', entityId: id, details: { order_no: existing.order_no }, req,
  });
  await sb.from('admin_notifications').insert({
    type: 'order', title: 'Order Permanently Deleted',
    body: 'Order ' + (existing.order_no || id.slice(0, 8)) + ' permanently deleted by ' + (admin.full_name || admin.email) + '.',
    link: '/pages/admin/dashboard.html#orders-deleted',
  });

  return res.status(200).json({ ok: true });
};
