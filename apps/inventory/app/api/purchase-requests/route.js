'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, parseInt(searchParams.get('limit') || '50', 10));
  const offset = (page - 1) * limit;
  const status = searchParams.get('status');

  let q = sb.from('inv_purchase_requests')
    .select('*, platform_users!requested_by(full_name), platform_users!approved_by(full_name), inv_purchase_request_items(*)', { count: 'exact' });
  if (status) q = q.eq('status', status);

  const { data, count, error } = await q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  if (error) return json({ error: 'Could not load purchase requests.' }, 500);
  return json({ requests: data || [], total: count || 0, page, limit });
}

export async function POST(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return json({ error: 'At least one item is required.' }, 400);

  const { data: pr, error: prErr } = await sb.from('inv_purchase_requests').insert({
    pr_number: body.pr_number || null,
    title: String(body.title || '').trim() || 'Purchase Request',
    notes: body.notes || null,
    requested_by: session.sub,
    status: 'pending',
    priority: body.priority || 'normal',
    needed_by: body.needed_by || null,
  }).select().single();
  if (prErr) return json({ error: 'Could not create purchase request.' }, 500);

  const itemRows = items.map(it => ({
    pr_id: pr.id,
    product_id: it.product_id || null,
    material_id: it.material_id || null,
    qty_requested: Number(it.qty_requested) || 1,
    unit_cost: Number(it.unit_cost) || 0,
    notes: it.notes || null,
  }));
  const { error: itemErr } = await sb.from('inv_purchase_request_items').insert(itemRows);
  if (itemErr) return json({ error: 'Could not add PR items.' }, 500);

  return json({ request: pr }, 201);
}
