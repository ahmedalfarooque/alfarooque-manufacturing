'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('inv_warehouses').select('*').order('name', { ascending: true });
  if (error) return json({ error: 'Could not load warehouses.' }, 500);
  return json({ warehouses: data || [] });
}

export async function POST(req) {
  const { response, session } = await requireAction(req, 'add');
  if (response) return response;
  const sb = getDb();

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'Warehouse name is required.' }, 400);

  const { data, error } = await sb.from('inv_warehouses').insert({
    name,
    code: body.code || null,
    address: body.address || null,
    city: body.city || null,
    manager_id: body.manager_id || null,
    is_active: true,
  }).select().single();
  if (error) return json({ error: 'Could not add warehouse.' }, 500);
  return json({ warehouse: data }, 201);
}
