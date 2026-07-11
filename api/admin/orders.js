'use strict';

/* /api/admin/orders — every Orders operation, routed by method + query/
   body, in ONE file. Consolidated from 5 separate files (orders.js +
   orders/{deleted,delete,recover,permanent}.js) purely to fit Vercel's
   Hobby-plan 12-serverless-function cap — the logic below is otherwise
   unchanged from those files (each responsibility stays its own
   function internally, nothing is duplicated, just no longer routed as
   a separate file).

   GET    ?id=<uuid>                       → single active order
   GET    ?page=&pageSize=&status=&search=&today=  → active orders list
   GET    ?deleted=1&page=&pageSize=&search=&status=&deletedBy=&dateFrom=&dateTo=&recovery=
                                            → Deleted Orders list (the ONLY
                                              query that reads is_deleted = true)
   PATCH  ?id=<uuid>  { status?, payment_status?, current_stage?,
                        estimated_completion?, estimated_delivery?,
                        tracking_pct?, admin_notes?, items?, discount?,
                        shipping_cost?, tracking_number?, courier?,
                        delivery_address? }
   POST   { action:'delete', id }            → soft delete
   POST   { action:'recover', id }           → recover
   POST   { action:'permanent-delete', id }  → real DB delete, Super Admin only

   Schema detection: hasSoftDelete(sb) (api/_ordersCore.js) checks once per
   warm instance whether supabase/schema-orders-soft-delete.sql has actually
   been run. If it hasn't, every query below simply skips the is_deleted
   filter — this file works identically against a pre- or post-migration
   database. Every response also carries `softDeleteEnabled` so the client
   can hide Delete/Recover/Permanent-Delete until the feature is usable. */

const { getAdminClient } = require('../_supabaseAdmin');
const { requireAdminSession, readJsonBody, logAudit } = require('../_adminAuth');
const { enrichOrderItems } = require('../_orderEnrich');
const {
  ALLOWED_STATUSES, ALLOWED_PAYMENT_STATUSES, RECOVERY_WINDOW_DAYS,
  isSuperAdmin, attachCustomerInfo, attachDeletedByInfo, daysRemaining, sendOrdersError, hasSoftDelete,
} = require('../_ordersCore');

/* ── GET ?deleted=1 — Deleted Orders list ── */
async function listDeletedOrders(sb, query, res) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 15));

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

  if (query.recovery && query.recovery !== 'all') {
    orders = orders.filter(o => {
      if (query.recovery === 'green') return o.days_remaining > 14;
      if (query.recovery === 'orange') return o.days_remaining > 3 && o.days_remaining <= 14;
      if (query.recovery === 'red') return o.days_remaining <= 3;
      return true;
    });
  }

  return res.status(200).json({ orders, total: count || 0, page, pageSize, softDeleteEnabled: true });
}

/* ── POST action:'delete' — soft delete ── */
async function softDeleteOrder(sb, admin, id, req, res) {
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
}

/* ── POST action:'recover' ── */
async function recoverOrder(sb, admin, id, req, res) {
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
}

/* ── POST action:'permanent-delete' — Super Admin only ── */
async function permanentlyDeleteOrder(sb, admin, id, req, res) {
  if (!isSuperAdmin(admin)) return res.status(403).json({ error: 'Only a Super Admin can permanently delete an order.' });
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
}

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  const sb = getAdminClient();
  const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);

  if (req.method === 'GET') {
    if (query.deleted === '1') return listDeletedOrders(sb, query, res);

    const softDeleteEnabled = await hasSoftDelete(sb);

    if (query.id) {
      let q = sb.from('orders').select('*').eq('id', query.id);
      if (softDeleteEnabled) q = q.eq('is_deleted', false);
      const { data, error } = await q.maybeSingle();
      if (error) return sendOrdersError(res, error);
      if (!data) return res.status(404).json({ error: 'Order not found.' });
      const [withInfo] = await attachCustomerInfo(sb, [data]);
      const [enriched] = await enrichOrderItems(sb, [withInfo]);
      return res.status(200).json({ order: enriched, softDeleteEnabled });
    }

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const from = (page - 1) * pageSize, to = from + pageSize - 1;

    let q = sb.from('orders')
      .select('id, order_no, status, payment_status, grand_total, created_at, guest_name, guest_email, user_id, items', { count: 'exact' })
      .order('created_at', { ascending: false });
    if (softDeleteEnabled) q = q.eq('is_deleted', false);
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
    if (error) return sendOrdersError(res, error);
    const withInfo = await attachCustomerInfo(sb, data || []);
    return res.status(200).json({ orders: withInfo, total: count || 0, page, pageSize, softDeleteEnabled });
  }

  if (req.method === 'PATCH') {
    const id = query.id;
    if (!id) return res.status(400).json({ error: 'Missing order id.' });
    const body = await readJsonBody(req);
    const softDeleteEnabled = await hasSoftDelete(sb);

    let existingQ = sb.from('orders').select('*').eq('id', id);
    if (softDeleteEnabled) existingQ = existingQ.eq('is_deleted', false);
    const { data: existing, error: fetchError } = await existingQ.maybeSingle();
    if (fetchError) return sendOrdersError(res, fetchError);
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
    if (body.tracking_number !== undefined) patch.tracking_number = String(body.tracking_number || '').slice(0, 200) || null;
    if (body.courier !== undefined) patch.courier = String(body.courier || '').slice(0, 200) || null;
    if (body.delivery_address !== undefined) patch.delivery_address = String(body.delivery_address || '').slice(0, 2000) || null;
    if (body.discount !== undefined) patch.discount = Math.max(0, Number(body.discount) || 0);
    if (body.shipping_cost !== undefined) patch.shipping_cost = Math.max(0, Number(body.shipping_cost) || 0);
    if (Array.isArray(body.items)) {
      patch.items = body.items.map(it => ({
        name: String((it && it.name) || '').slice(0, 300),
        qty: Math.max(1, Number(it && it.qty) || 1),
        price: Math.max(0, Number(it && it.price) || 0),
      }));
    }

    if (patch.items || patch.discount !== undefined || patch.shipping_cost !== undefined) {
      const items = patch.items || existing.items || [];
      const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);
      const vat = Math.round(subtotal * 0.15 * 100) / 100;
      const shipping = patch.shipping_cost !== undefined ? patch.shipping_cost : (Number(existing.shipping_cost) || 0);
      const discount = patch.discount !== undefined ? patch.discount : (Number(existing.discount) || 0);
      patch.subtotal = Math.round(subtotal * 100) / 100;
      patch.vat = vat;
      patch.grand_total = Math.max(0, Math.round((subtotal + vat + shipping - discount) * 100) / 100);
    }

    if (patch.status && patch.status !== existing.status) {
      const timeline = Array.isArray(existing.timeline) ? existing.timeline.slice() : [];
      timeline.push({ status: patch.status, at: new Date().toISOString(), note: body.note || null });
      patch.timeline = timeline;
    }

    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update.' });

    const { data, error } = await sb.from('orders').update(patch).eq('id', id).select().single();
    if (error) return sendOrdersError(res, error);

    await logAudit(sb, {
      adminId: admin.id, adminEmail: admin.email, action: 'order.update',
      entityType: 'order', entityId: id, details: patch, req,
    });

    if (patch.status) {
      await sb.from('admin_notifications').insert({
        type: 'order', title: 'Order ' + (existing.order_no || id.slice(0, 8)) + ' updated',
        body: 'Status changed to ' + patch.status, link: '/pages/admin/dashboard.html#orders',
      });
    }

    return res.status(200).json({ order: data });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    const id = body.id;
    if (!id) return res.status(400).json({ error: 'Missing order id.' });

    if (body.action === 'delete') return softDeleteOrder(sb, admin, id, req, res);
    if (body.action === 'recover') return recoverOrder(sb, admin, id, req, res);
    if (body.action === 'permanent-delete') return permanentlyDeleteOrder(sb, admin, id, req, res);
    return res.status(400).json({ error: 'Unknown action.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
