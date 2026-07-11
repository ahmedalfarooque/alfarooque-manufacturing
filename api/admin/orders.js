'use strict';

/* /api/admin/orders — ACTIVE orders (is_deleted = false when the
   soft-delete migration has been applied; every order otherwise).
   GET   ?id=<uuid>              → single order
   GET   ?page=&pageSize=&status=&search=&today=  → paginated list
   PATCH ?id=<uuid>  { status?, payment_status?, current_stage?,
                        estimated_completion?, estimated_delivery?,
                        tracking_pct?, admin_notes?, items?, discount?,
                        shipping_cost?, tracking_number?, courier?,
                        delivery_address? }

   Deleted-orders listing, soft delete, recover, and permanent delete
   each live in their own dedicated endpoint (see api/admin/orders/*.js)
   — this file never branches on an "action" or a "deleted" flag, so
   there's exactly one query shape to reason about here: active orders.

   Schema detection: hasSoftDelete(sb) (api/_ordersCore.js) checks once
   per warm instance whether supabase/schema-orders-soft-delete.sql has
   actually been run. If it hasn't, every query below simply skips the
   is_deleted filter — this file works identically against a pre- or
   post-migration database, no code change needed either way. Every
   response also carries `softDeleteEnabled` so the client can hide the
   Delete button until the feature is actually usable.

   Every write lands directly in public.orders — the same table the
   customer dashboard reads live, so status/tracking changes are visible
   to the customer the next time their dashboard loads or re-syncs.
   Editing items/discount/shipping_cost recomputes subtotal/vat/grand_total
   server-side so the stored totals always match what was actually saved. */

const { getAdminClient } = require('../_supabaseAdmin');
const { requireAdminSession, readJsonBody, logAudit } = require('../_adminAuth');
const { enrichOrderItems } = require('../_orderEnrich');
const { ALLOWED_STATUSES, ALLOWED_PAYMENT_STATUSES, attachCustomerInfo, sendOrdersError, hasSoftDelete } = require('../_ordersCore');

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  const sb = getAdminClient();
  const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const softDeleteEnabled = await hasSoftDelete(sb);

  if (req.method === 'GET') {
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

    /* List view only ever renders these columns (see loadOrdersTable in
       js/admin/dashboard.js) — the single-order GET above still uses
       select('*') since the View/Edit modals need every field. */
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

    /* Editing line items, discount, or shipping changes the money — keep
       the stored totals authoritative rather than trusting a stale client
       value for anything money-related. */
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
