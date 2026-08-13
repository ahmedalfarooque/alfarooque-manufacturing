'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, requireDelete , requireAction } = require('@/lib/http');

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('inv_warehouses').select('*, inv_locations(*)').eq('id', params.id).maybeSingle();
  if (error) return json({ error: 'Could not load warehouse.' }, 500);
  if (!data) return json({ error: 'Warehouse not found.' }, 404);
  return json({ warehouse: data });
}

export async function PUT(req, { params }) {
  const { response, session } = await requireAction(req, 'edit');
  if (response) return response;
  const sb = getDb();

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
  const { response, session } = await requireDelete(req);
  if (response) return response;
  const sb = getDb();

  const { error } = await sb.from('inv_warehouses').update({ is_active: false }).eq('id', params.id);
  if (error) return json({ error: 'Could not deactivate warehouse.' }, 500);
  return json({ ok: true });
}
