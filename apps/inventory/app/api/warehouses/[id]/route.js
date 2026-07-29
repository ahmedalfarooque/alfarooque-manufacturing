'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('inv_warehouses').select('*, inv_locations(*)').eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load warehouse.' }, 500);
  if (!data) return json({ error: 'Warehouse not found.' }, 404);
  return json({ warehouse: data });
}

export async function PUT(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'admin')) return json({ error: 'Admin access required.' }, 403);

  const body = await req.json().catch(() => ({}));
  const { error } = await sb.from('inv_warehouses').update({
    name: body.name,
    code: body.code || null,
    address: body.address || null,
    city: body.city || null,
    manager_id: body.manager_id || null,
    is_active: body.is_active !== false,
  }).eq('id', params.id);
  if (error) return json({ error: 'Could not update warehouse.' }, 500);
  return json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'admin')) return json({ error: 'Admin access required.' }, 403);

  const { error } = await sb.from('inv_warehouses').update({ is_active: false }).eq('id', params.id);
  if (error) return json({ error: 'Could not deactivate warehouse.' }, 500);
  return json({ ok: true });
}
