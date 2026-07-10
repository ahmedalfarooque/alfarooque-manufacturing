'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');

export async function GET(req) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const sb = getDb();
  const { data, error } = await sb.from('qt_material_categories')
    .select('id, parent_id, name, kind, sort')
    .order('sort');
  if (error) return json({ error: error.message }, 500);
  return json({ rows: data || [] });
}

export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  if (!body.name || !String(body.name).trim()) return json({ error: 'Category name is required.' }, 400);
  const { data: max } = await sb.from('qt_material_categories').select('sort').order('sort', { ascending: false }).limit(1);
  const { data, error } = await sb.from('qt_material_categories').insert({
    name: String(body.name).trim(),
    kind: body.kind === 'hardware' ? 'hardware' : 'material',
    sort: ((max && max[0] && max[0].sort) || 0) + 1,
  }).select().single();
  if (error) return json({ error: error.message }, 400);
  await audit(sb, 'qt_material_categories', data.id, 'insert', null, data, session.sub);
  return json({ row: data }, 201);
}

export async function PATCH(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  if (!body.id) return json({ error: 'id required' }, 400);
  const patch = {};
  if (body.name !== undefined) {
    if (!String(body.name).trim()) return json({ error: 'Category name is required.' }, 400);
    patch.name = String(body.name).trim();
  }
  if (body.kind !== undefined) patch.kind = body.kind === 'hardware' ? 'hardware' : 'material';
  const { data, error } = await sb.from('qt_material_categories').update(patch).eq('id', body.id).select().single();
  if (error) return json({ error: error.message }, 400);
  await audit(sb, 'qt_material_categories', body.id, 'update', null, patch, session.sub);
  return json({ row: data });
}

export async function DELETE(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  if (!body.id) return json({ error: 'id required' }, 400);
  /* Materials keep working — their category simply becomes unset. */
  await sb.from('qt_materials').update({ category_id: null }).eq('category_id', body.id);
  const { error } = await sb.from('qt_material_categories').delete().eq('id', body.id);
  if (error) return json({ error: error.message }, 400);
  await audit(sb, 'qt_material_categories', body.id, 'delete', null, null, session.sub);
  return json({ ok: true });
}
