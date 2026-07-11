'use strict';

/* Single-order GET/PATCH — same public.orders table as the Website
   Admin (see apps/projects/lib/ordersQuotesCore.js). */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { ORDER_STATUSES, ORDER_PAYMENT_STATUSES, hasSoftDelete, logError, attachCustomerInfo } = require('@/lib/ordersQuotesCore');
const { enrichOrderItems } = require('@/lib/orderEnrich');

export async function GET(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const softDeleteEnabled = await hasSoftDelete(sb, 'orders');
  let q = sb.from('orders').select('*').eq('id', params.id);
  if (softDeleteEnabled) q = q.eq('is_deleted', false);
  const { data, error } = await q.maybeSingle();
  if (error) return json({ error: logError('orders', error, 'Orders') }, 500);
  if (!data) return json({ error: 'Order not found.' }, 404);
  const [withInfo] = await attachCustomerInfo(sb, [data]);
  const order = await enrichOrderItems(sb, withInfo);
  return json({ order, softDeleteEnabled });
}

export async function PATCH(req, { params }) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const sb = getDb();
  const softDeleteEnabled = await hasSoftDelete(sb, 'orders');

  let existingQ = sb.from('orders').select('*').eq('id', params.id);
  if (softDeleteEnabled) existingQ = existingQ.eq('is_deleted', false);
  const { data: existing, error: fetchError } = await existingQ.maybeSingle();
  if (fetchError) return json({ error: logError('orders', fetchError, 'Orders') }, 500);
  if (!existing) return json({ error: 'Order not found.' }, 404);

  const patch = {};
  if (body.status !== undefined) {
    if (!ORDER_STATUSES.includes(body.status)) return json({ error: 'Invalid status.' }, 400);
    patch.status = body.status;
  }
  if (body.payment_status !== undefined) {
    if (!ORDER_PAYMENT_STATUSES.includes(body.payment_status)) return json({ error: 'Invalid payment status.' }, 400);
    patch.payment_status = body.payment_status;
  }
  if (body.current_stage !== undefined) patch.current_stage = body.current_stage;
  if (body.tracking_pct !== undefined) patch.tracking_pct = Math.max(0, Math.min(100, Number(body.tracking_pct) || 0));
  if (body.admin_notes !== undefined) patch.admin_notes = String(body.admin_notes || '').slice(0, 2000);
  if (body.tracking_number !== undefined) patch.tracking_number = String(body.tracking_number || '').slice(0, 200) || null;
  if (body.courier !== undefined) patch.courier = String(body.courier || '').slice(0, 200) || null;
  if (body.delivery_address !== undefined) patch.delivery_address = String(body.delivery_address || '').slice(0, 2000) || null;

  if (patch.status && patch.status !== existing.status) {
    const timeline = Array.isArray(existing.timeline) ? existing.timeline.slice() : [];
    timeline.push({ status: patch.status, at: new Date().toISOString(), note: body.note || null, source: 'projects' });
    patch.timeline = timeline;
  }

  if (!Object.keys(patch).length) return json({ error: 'Nothing to update.' }, 400);

  const { data, error } = await sb.from('orders').update(patch).eq('id', params.id).select().single();
  if (error) return json({ error: logError('orders', error, 'Orders') }, 500);

  if (patch.status) {
    await sb.from('admin_notifications').insert({
      type: 'order', title: 'Order ' + (existing.order_no || params.id.slice(0, 8)) + ' updated',
      body: 'Status changed to ' + patch.status + ' (via Projects)', link: '/pages/admin/dashboard.html#orders',
    }).catch(() => {});
  }

  return json({ order: data });
}
