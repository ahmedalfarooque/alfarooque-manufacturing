'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('inv_purchase_requests')
    .select('*, inv_purchase_request_items(*, inv_products(name, sku), inv_materials(name, material_code))')
    .eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load purchase request.' }, 500);
  if (!data) return json({ error: 'Purchase request not found.' }, 404);
  return json({ request: data });
}

export async function PUT(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);

  const body = await req.json().catch(() => ({}));
  const { data: pr } = await sb.from('inv_purchase_requests').select('status').eq('id', params.id).maybeSingle();
  if (!pr) return json({ error: 'Purchase request not found.' }, 404);

  if (body.action === 'approve') {
    if (!can(invRole, 'approve')) return json({ error: 'Approve permission required.' }, 403);
    if (pr.status !== 'pending') return json({ error: 'Only pending requests can be approved.' }, 400);
    await sb.from('inv_purchase_requests').update({
      status: 'approved', approved_by: session.sub, approved_at: new Date().toISOString(),
    }).eq('id', params.id);
    return json({ ok: true });
  }

  if (body.action === 'reject') {
    if (!can(invRole, 'approve')) return json({ error: 'Approve permission required.' }, 403);
    await sb.from('inv_purchase_requests').update({
      status: 'rejected', approved_by: session.sub, approved_at: new Date().toISOString(),
      notes: body.notes || null,
    }).eq('id', params.id);
    return json({ ok: true });
  }

  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);
  if (pr.status !== 'pending') return json({ error: 'Cannot edit a processed request.' }, 400);

  await sb.from('inv_purchase_requests').update({
    title: body.title,
    notes: body.notes,
    priority: body.priority,
    needed_by: body.needed_by || null,
  }).eq('id', params.id);

  return json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'admin')) return json({ error: 'Admin access required.' }, 403);

  await sb.from('inv_purchase_request_items').delete().eq('pr_id', params.id);
  const { error } = await sb.from('inv_purchase_requests').delete().eq('id', params.id);
  if (error) return json({ error: 'Could not delete purchase request.' }, 500);
  return json({ ok: true });
}
