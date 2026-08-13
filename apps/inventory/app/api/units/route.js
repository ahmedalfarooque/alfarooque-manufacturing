'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, requireDelete , requireAction } = require('@/lib/http');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('inv_units').select('*').order('name', { ascending: true });
  if (error) return json({ error: 'Could not load units.' }, 500);
  return json({ units: data || [] });
}

export async function POST(req) {
  const { response, session } = await requireAction(req, 'add');
  if (response) return response;
  const sb = getDb();

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const symbol = String(body.symbol || '').trim();
  if (!name) return json({ error: 'Unit name is required.' }, 400);

  const { data, error } = await sb.from('inv_units').insert({ name, symbol }).select().single();
  if (error) return json({ error: 'Could not add unit.' }, 500);
  return json({ unit: data }, 201);
}

export async function PUT(req) {
  const { response, session } = await requireAction(req, 'edit');
  if (response) return response;
  const sb = getDb();

  const body = await req.json().catch(() => ({}));
  if (!body.id) return json({ error: 'Unit id is required.' }, 400);
  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'Unit name is required.' }, 400);

  const { error } = await sb.from('inv_units').update({ name, symbol: body.symbol }).eq('id', body.id);
  if (error) return json({ error: 'Could not update unit.' }, 500);
  return json({ ok: true });
}

export async function DELETE(req) {
  const { response, session } = await requireDelete(req);
  if (response) return response;
  const sb = getDb();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return json({ error: 'Unit id is required.' }, 400);

  const { error } = await sb.from('inv_units').delete().eq('id', id);
  if (error) return json({ error: 'Could not delete unit.' }, 500);
  return json({ ok: true });
}
