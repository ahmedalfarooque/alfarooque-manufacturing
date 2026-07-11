'use strict';

/* /api/admin/orders/delete — POST { id } → SOFT delete only.
   Never removes the row: flags is_deleted/deleted_at/deleted_by and
   schedules auto_delete_at 30 days out for the cleanup cron
   (api/cron/cleanup-deleted-orders.js). The order and every related
   record (customer link, items, payment fields, notes) stay exactly
   as they were — only the flag changes, so Recover can restore
   everything with nothing to reconstruct. */

const { getAdminClient } = require('../../_supabaseAdmin');
const { requireAdminSession, readJsonBody, logAudit } = require('../../_adminAuth');
const { RECOVERY_WINDOW_DAYS, sendOrdersError, hasSoftDelete } = require('../../_ordersCore');

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = await readJsonBody(req);
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'Missing order id.' });

  const sb = getAdminClient();
  if (!(await hasSoftDelete(sb))) return res.status(409).json({ error: 'Soft Delete feature has not been enabled yet.', softDeleteEnabled: false });

  const { data: existing, error: fetchError } = await sb.from('orders').select('id, order_no, is_deleted').eq('id', id).maybeSingle();
  if (fetchError) return sendOrdersError(res, fetchError);
  if (!existing) return res.status(404).json({ error: 'Order not found.' });
  if (existing.is_deleted) return res.status(400).json({ error: 'Order is already deleted.' });

  const now = new Date();
  const autoDeleteAt = new Date(now.getTime() + RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await sb.from('orders').update({
    is_deleted: true, deleted_at: now.toISOString(), deleted_by: admin.id,
    auto_delete_at: autoDeleteAt.toISOString(), recovered_at: null, recovered_by: null,
  }).eq('id', id).select().single();
  if (error) return sendOrdersError(res, error);

  await logAudit(sb, {
    adminId: admin.id, adminEmail: admin.email, action: 'order.delete',
    entityType: 'order', entityId: id, details: { order_no: existing.order_no }, req,
  });
  await sb.from('admin_notifications').insert({
    type: 'order', title: 'Order Deleted',
    body: 'Order ' + (existing.order_no || id.slice(0, 8)) + ' deleted by ' + (admin.full_name || admin.email) + '.',
    link: '/pages/admin/dashboard.html#orders-deleted',
  });

  return res.status(200).json({ order: data });
};
