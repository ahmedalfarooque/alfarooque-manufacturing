'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = ['maintenance_type', 'last_service_km', 'interval_km', 'notes'];

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  for (const key of EDITABLE) if (key in body) patch[key] = body[key];
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);
  if ('last_service_km' in patch) patch.last_service_km = Number(patch.last_service_km || 0);
  if ('interval_km' in patch) patch.interval_km = Number(patch.interval_km || 10000);

  const sb = getDb();
  const { data, error } = await sb.from('car_maintenance').update(patch).eq('id', params.id).select('*, cars(vehicle_number, current_km, is_active)').maybeSingle();
  if (error) { console.error('[maintenance] update failed:', error.message); return json({ error: 'Could not update schedule item.' }, 500); }
  if (!data) return json({ error: 'Schedule item not found.' }, 404);
  return json({ item: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('car_maintenance').delete().eq('id', params.id);
  if (error) { console.error('[maintenance] delete failed:', error.message); return json({ error: 'Could not delete schedule item.' }, 500); }
  return json({ ok: true });
}
