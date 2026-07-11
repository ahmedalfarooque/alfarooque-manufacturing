'use strict';

/* /api/admin/orders/recover — POST { id } → moves an order back from
   Deleted Orders to Orders. Only the soft-delete flags are touched
   (is_deleted, recovered_at/by, auto_delete_at) — status, items,
   payment_status, customer link, notes and every timestamp on the row
   were never modified by the delete in the first place, so nothing
   needs to be "restored" beyond flipping the flag back off. */

const { getAdminClient } = require('../../_supabaseAdmin');
const { requireAdminSession, readJsonBody, logAudit } = require('../../_adminAuth');
const { sendOrdersError, hasSoftDelete } = require('../../_ordersCore');

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
  if (!existing.is_deleted) return res.status(400).json({ error: 'Order is not deleted.' });

  const { data, error } = await sb.from('orders').update({
    is_deleted: false, recovered_at: new Date().toISOString(), recovered_by: admin.id, auto_delete_at: null,
  }).eq('id', id).select().single();
  if (error) return sendOrdersError(res, error);

  await logAudit(sb, {
    adminId: admin.id, adminEmail: admin.email, action: 'order.recover',
    entityType: 'order', entityId: id, details: { order_no: existing.order_no }, req,
  });
  await sb.from('admin_notifications').insert({
    type: 'order', title: 'Order Recovered',
    body: 'Order ' + (existing.order_no || id.slice(0, 8)) + ' restored successfully.',
    link: '/pages/admin/dashboard.html#orders',
  });

  return res.status(200).json({ order: data });
};
