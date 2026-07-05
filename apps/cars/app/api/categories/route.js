'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb.from('maintenance_categories').select('*').order('name', { ascending: true });
  if (error) { console.error('[categories] list failed:', error.message); return json({ error: 'Could not load categories.' }, 500); }
  return json({ categories: data || [] });
}

export async function POST(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'Category name is required.' }, 400);

  const sb = getDb();
  const { data: existing } = await sb.from('maintenance_categories').select('id').eq('name', name).maybeSingle();
  if (existing) return json({ error: 'This category already exists.' }, 409);

  const { data, error } = await sb.from('maintenance_categories').insert({ name, is_default: false }).select().single();
  if (error) { console.error('[categories] create failed:', error.message); return json({ error: 'Could not add category.' }, 500); }
  return json({ category: data }, 201);
}
