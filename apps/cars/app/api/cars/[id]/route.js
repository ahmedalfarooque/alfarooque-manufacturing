'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = ['vehicle_number', 'name', 'make', 'model', 'year', 'color', 'serial_number',
  'type', 'fuel_type', 'driver', 'status', 'condition_status', 'oil_type', 'oil_viscosity',
  'oil_capacity_l', 'current_km', 'distance_km', 'location', 'notes'];

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  for (const key of EDITABLE) if (key in body) patch[key] = body[key];
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);
  patch.last_update = new Date().toISOString();

  const sb = getDb();
  const { data, error } = await sb.from('cars').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[cars] update failed:', error.message); return json({ error: 'Could not update vehicle.' }, 500); }
  if (!data) return json({ error: 'Vehicle not found.' }, 404);
  return json({ vehicle: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('cars').update({ is_active: false }).eq('id', params.id);
  if (error) { console.error('[cars] delete failed:', error.message); return json({ error: 'Could not delete vehicle.' }, 500); }
  return json({ ok: true });
}
