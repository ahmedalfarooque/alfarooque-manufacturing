'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getInvRole, can } = require('@/lib/perms');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('inv_brands').select('*').order('name', { ascending: true });
  if (error) return json({ error: 'Could not load brands.' }, 500);
  return json({ brands: data || [] });
}

export async function POST(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'Brand name is required.' }, 400);

  const { data, error } = await sb.from('inv_brands').insert({ name, description: body.description }).select().single();
  if (error) return json({ error: 'Could not add brand.' }, 500);
  return json({ brand: data }, 201);
}

export async function PUT(req) {
  const { response, session } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  if (!can(invRole, 'write')) return json({ error: 'Insufficient permissions.' }, 403);

  const body = await req.json().catch(() => ({}));
  if (!body.id) return json({ error: 'Brand id is required.' }, 400);

  const { error } = await sb.from('inv_brands').update({ name: body.name, description: body.description }).eq('id', body.id);
  if (error) return json({ error: 'Could not update brand.' }, 500);
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
  if (!id) return json({ error: 'Brand id is required.' }, 400);

  const { error } = await sb.from('inv_brands').delete().eq('id', id);
  if (error) return json({ error: 'Could not delete brand.' }, 500);
  return json({ ok: true });
}
