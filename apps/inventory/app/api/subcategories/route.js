'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, requireDelete , requireAction } = require('@/lib/http');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get('category_id');
  let q = sb.from('inv_subcategories').select('*, inv_categories(name)').order('name', { ascending: true });
  if (categoryId) q = q.eq('category_id', categoryId);
  const { data, error } = await q;
  if (error) return json({ error: 'Could not load subcategories.' }, 500);
  return json({ subcategories: data || [] });
}

export async function POST(req) {
  const { response, session } = await requireAction(req, 'add');
  if (response) return response;
  const sb = getDb();

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'Subcategory name is required.' }, 400);
  if (!body.category_id) return json({ error: 'Category is required.' }, 400);

  const { data, error } = await sb.from('inv_subcategories').insert({ name, category_id: body.category_id, description: body.description }).select().single();
  if (error) return json({ error: 'Could not add subcategory.' }, 500);
  return json({ subcategory: data }, 201);
}

export async function PUT(req) {
  const { response, session } = await requireAction(req, 'edit');
  if (response) return response;
  const sb = getDb();

  const body = await req.json().catch(() => ({}));
  if (!body.id) return json({ error: 'Subcategory id is required.' }, 400);

  const { error } = await sb.from('inv_subcategories').update({
    name: body.name, category_id: body.category_id, description: body.description,
  }).eq('id', body.id);
  if (error) return json({ error: 'Could not update subcategory.' }, 500);
  return json({ ok: true });
}

export async function DELETE(req) {
  const { response, session } = await requireDelete(req);
  if (response) return response;
  const sb = getDb();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return json({ error: 'Subcategory id is required.' }, 400);

  const { error } = await sb.from('inv_subcategories').delete().eq('id', id);
  if (error) return json({ error: 'Could not delete subcategory.' }, 500);
  return json({ ok: true });
}
