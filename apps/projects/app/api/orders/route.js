'use strict';

/* Orders module, shared with the Website Admin via the same public.orders
   table (see apps/projects/lib/ordersQuotesCore.js for the shared-source-
   of-truth rationale). Admin-only, same as every other Projects module.

   GET  (no params)                    -> active orders list
   GET  ?deleted=1                     -> Deleted Orders list (the only
                                          query that reads is_deleted=true)
   POST { action:'delete', id }        -> soft delete
   POST { action:'recover', id }       -> recover
   POST { action:'permanent-delete', id } -> real delete, Super Admin only */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const {
  RECOVERY_WINDOW_DAYS, isSuperAdmin, hasSoftDelete, logError, daysRemaining,
  attachActorNames, attachCustomerInfo,
} = require('@/lib/ordersQuotesCore');
const { notifyOrdersQuotes } = require('@/lib/notifyOrdersQuotes');

async function listDeleted(sb, url) {
  const softDeleteEnabled = await hasSoftDelete(sb, 'orders');
  if (!softDeleteEnabled) return json({ orders: [], softDeleteEnabled: false });

  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || 'all';
  const recovery = url.searchParams.get('recovery') || 'all';

  let q = sb.from('orders')
    .select('id, order_no, status, payment_status, grand_total, created_at, guest_name, guest_email, user_id, deleted_at, deleted_by, auto_delete_at')
    .eq('is_deleted', true)
    .order('deleted_at', { ascending: false });
  if (search) q = q.or('order_no.ilike.%' + search + '%,guest_name.ilike.%' + search + '%,guest_email.ilike.%' + search + '%');
  if (status !== 'all') q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return json({ error: logError('orders', error, 'Orders') }, 500);

  let orders = await attachCustomerInfo(sb, data || []);
  orders = await attachActorNames(sb, orders, 'deleted_by', 'deleted_by_name');
  orders = orders.map(o => Object.assign({}, o, { days_remaining: daysRemaining(o) }));

  if (recovery !== 'all') {
    orders = orders.filter(o => {
      if (recovery === 'green') return o.days_remaining > 14;
      if (recovery === 'orange') return o.days_remaining > 3 && o.days_remaining <= 14;
      if (recovery === 'red') return o.days_remaining <= 3;
      return true;
    });
  }

  return json({ orders, softDeleteEnabled: true });
}

export async function GET(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const url = new URL(req.url);
  if (url.searchParams.get('deleted') === '1') return listDeleted(sb, url);

  const softDeleteEnabled = await hasSoftDelete(sb, 'orders');
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || 'all';

  let q = sb.from('orders')
    .select('id, order_no, status, payment_status, grand_total, created_at, guest_name, guest_email, user_id, items')
    .order('created_at', { ascending: false });
  if (softDeleteEnabled) q = q.eq('is_deleted', false);
  if (status !== 'all') q = q.eq('status', status);
  if (search) q = q.or('order_no.ilike.%' + search + '%,guest_name.ilike.%' + search + '%,guest_email.ilike.%' + search + '%');

  const { data, error } = await q.limit(500);
  if (error) return json({ error: logError('orders', error, 'Orders') }, 500);
  const orders = await attachCustomerInfo(sb, data || []);
  return json({ orders, softDeleteEnabled });
}

export async function POST(req) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const id = body.id;
  if (!id) return json({ error: 'Missing order id.' }, 400);

  const sb = getDb();

  if (body.action === 'delete') {
    if (!(await hasSoftDelete(sb, 'orders'))) return json({ error: 'Soft Delete feature has not been enabled yet.', softDeleteEnabled: false }, 409);
    const { data: existing, error: fetchError } = await sb.from('orders').select('id, order_no, is_deleted').eq('id', id).maybeSingle();
    if (fetchError) return json({ error: logError('orders', fetchError, 'Orders') }, 500);
    if (!existing) return json({ error: 'Order not found.' }, 404);
    if (existing.is_deleted) return json({ error: 'Order is already deleted.' }, 400);

    const now = new Date();
    const autoDeleteAt = new Date(now.getTime() + RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const { data, error } = await sb.from('orders').update({
      is_deleted: true, deleted_at: now.toISOString(), deleted_by: session.sub,
      auto_delete_at: autoDeleteAt.toISOString(), recovered_at: null, recovered_by: null,
    }).eq('id', id).select().single();
    if (error) return json({ error: logError('orders', error, 'Orders') }, 500);

    await notifyOrdersQuotes(sb, {
      type: 'order', title: 'Order Deleted',
      body: 'Order ' + (existing.order_no || id.slice(0, 8)) + ' deleted by ' + session.email + ' (Projects).',
      adminLink: '/pages/admin/dashboard.html#orders-deleted', projectsLink: '/orders-deleted',
    });
    return json({ order: data });
  }

  if (body.action === 'recover') {
    if (!(await hasSoftDelete(sb, 'orders'))) return json({ error: 'Soft Delete feature has not been enabled yet.', softDeleteEnabled: false }, 409);
    const { data: existing, error: fetchError } = await sb.from('orders').select('id, order_no, is_deleted').eq('id', id).maybeSingle();
    if (fetchError) return json({ error: logError('orders', fetchError, 'Orders') }, 500);
    if (!existing) return json({ error: 'Order not found.' }, 404);
    if (!existing.is_deleted) return json({ error: 'Order is not deleted.' }, 400);

    const { data, error } = await sb.from('orders').update({
      is_deleted: false, recovered_at: new Date().toISOString(), recovered_by: session.sub, auto_delete_at: null,
    }).eq('id', id).select().single();
    if (error) return json({ error: logError('orders', error, 'Orders') }, 500);

    await notifyOrdersQuotes(sb, {
      type: 'order', title: 'Order Recovered',
      body: 'Order ' + (existing.order_no || id.slice(0, 8)) + ' restored successfully.',
      adminLink: '/pages/admin/dashboard.html#orders', projectsLink: '/orders',
    });
    return json({ order: data });
  }

  if (body.action === 'permanent-delete') {
    if (!isSuperAdmin(session)) return json({ error: 'Only a Super Admin can permanently delete an order.' }, 403);
    if (!(await hasSoftDelete(sb, 'orders'))) return json({ error: 'Soft Delete feature has not been enabled yet.', softDeleteEnabled: false }, 409);
    const { data: existing, error: fetchError } = await sb.from('orders').select('id, order_no, is_deleted').eq('id', id).maybeSingle();
    if (fetchError) return json({ error: logError('orders', fetchError, 'Orders') }, 500);
    if (!existing) return json({ error: 'Order not found.' }, 404);
    if (!existing.is_deleted) return json({ error: 'Only a soft-deleted order can be permanently deleted.' }, 400);

    const { error } = await sb.from('orders').delete().eq('id', id);
    if (error) return json({ error: logError('orders', error, 'Orders') }, 500);

    await notifyOrdersQuotes(sb, {
      type: 'order', title: 'Order Permanently Deleted',
      body: 'Order ' + (existing.order_no || id.slice(0, 8)) + ' permanently deleted by ' + session.email + '.',
      adminLink: '/pages/admin/dashboard.html#orders-deleted', projectsLink: '/orders-deleted',
    });
    return json({ ok: true });
  }

  return json({ error: 'Unknown action.' }, 400);
}
