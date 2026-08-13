'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, requireDelete , requireAction } = require('@/lib/http');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('inv_categories').select('*').order('name', { ascending: true });
  if (error) { console.error('[categories] list failed:', error.message); return json({ error: 'Could not load categories.' }, 500); }
  return json({ categories: data || [] });
}

export async function POST(req) {
  const { response, session } = await requireAction(req, 'add');
  if (response) return response;
  const sb = getDb();

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const type = String(body.type || 'product').trim();
  const description = String(body.description || '').trim();
  if (!name) return json({ error: 'Category name is required.' }, 400);

  const { data: existing } = await sb.from('inv_categories').select('id').eq('name', name).maybeSingle();
  if (existing) return json({ error: 'This category already exists.' }, 409);

  const { data, error } = await sb.from('inv_categories').insert({ name, type, description }).select().single();
  if (error) { console.error('[categories] create failed:', error.message); return json({ error: 'Could not add category.' }, 500); }
  return json({ category: data }, 201);
}

export async function PUT(req) {
  const { response, session } = await requireAction(req, 'edit');
  if (response) return response;
  const sb = getDb();

  const body = await req.json().catch(() => ({}));
  if (!body.id) return json({ error: 'Category id is required.' }, 400);
  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'Category name is required.' }, 400);

  const { error } = await sb.from('inv_categories').update({
    name, type: body.type, description: body.description,
  }).eq('id', body.id);
  if (error) return json({ error: 'Could not update category.' }, 500);
  return json({ ok: true });
}

export async function DELETE(req) {
  const { response, session } = await requireDelete(req);
  if (response) return response;
  const sb = getDb();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return json({ error: 'Category id is required.' }, 400);

  const { error } = await sb.from('inv_categories').delete().eq('id', id);
  if (error) return json({ error: 'Could not delete category.' }, 500);
  return json({ ok: true });
}
