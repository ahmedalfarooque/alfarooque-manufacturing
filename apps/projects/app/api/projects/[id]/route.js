'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = ['customer_name', 'company_name', 'project_name', 'value', 'start_date', 'end_date', 'status', 'progress', 'notes'];

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  for (const key of EDITABLE) if (key in body) patch[key] = body[key];
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('pm_projects').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[projects] update failed:', error.message); return json({ error: 'Could not update project.' }, 500); }
  if (!data) return json({ error: 'Project not found.' }, 404);

  if (patch.status) await sb.from('pm_project_logs').insert({ project_id: params.id, activity: `Status changed to ${patch.status}` });
  return json({ project: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('pm_projects').delete().eq('id', params.id);
  if (error) { console.error('[projects] delete failed:', error.message); return json({ error: 'Could not delete project.' }, 500); }
  return json({ ok: true });
}
