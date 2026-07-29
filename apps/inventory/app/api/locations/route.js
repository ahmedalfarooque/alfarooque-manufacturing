'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { searchParams } = new URL(req.url);
  const warehouseId = searchParams.get('warehouse_id');
  let q = sb.from('inv_locations').select('*, inv_warehouses(name)').order('name', { ascending: true });
  if (warehouseId) q = q.eq('warehouse_id', warehouseId);
  const { data, error } = await q;
  if (error) return json({ error: 'Could not load locations.' }, 500);
  return json({ locations: data || [] });
}

export async function POST(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'Location name is required.' }, 400);
  if (!body.warehouse_id) return json({ error: 'Warehouse is required.' }, 400);

  const { data, error } = await sb.from('inv_locations').insert({
    name,
    code: body.code || null,
    warehouse_id: body.warehouse_id,
    type: body.type || 'zone',
    is_active: true,
  }).select().single();
  if (error) return json({ error: 'Could not add location.' }, 500);
  return json({ location: data }, 201);
}

export async function PUT(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

  const body = await req.json().catch(() => ({}));
  if (!body.id) return json({ error: 'Location id is required.' }, 400);

  const { error } = await sb.from('inv_locations').update({
    name: body.name,
    code: body.code || null,
    warehouse_id: body.warehouse_id,
    type: body.type,
    is_active: body.is_active !== false,
  }).eq('id', body.id);
  if (error) return json({ error: 'Could not update location.' }, 500);
  return json({ ok: true });
}

export async function DELETE(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'admin')) return json({ error: 'Admin access required.' }, 403);

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return json({ error: 'Location id is required.' }, 400);

  const { error } = await sb.from('inv_locations').update({ is_active: false }).eq('id', id);
  if (error) return json({ error: 'Could not deactivate location.' }, 500);
  return json({ ok: true });
}
