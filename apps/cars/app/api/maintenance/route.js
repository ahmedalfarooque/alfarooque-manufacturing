'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

function withComputedStatus(row) {
  const currentKm = Number(row.cars?.current_km || 0);
  const nextDueKm = Number(row.last_service_km) + Number(row.interval_km);
  const remainingKm = nextDueKm - currentKm;
  const pct = Number(row.interval_km) > 0 ? 1 - remainingKm / Number(row.interval_km) : 0;
  let status = 'Healthy';
  if (remainingKm <= 0) status = 'Overdue';
  else if (pct >= 0.9) status = 'Upcoming';
  return { ...row, vehicle_number: row.cars?.vehicle_number, current_km: currentKm, next_due_km: nextDueKm, remaining_km: remainingKm, status };
}

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('car_maintenance').select('*, cars(vehicle_number, current_km, is_active)').order('created_at', { ascending: false });
  if (error) { console.error('[maintenance] list failed:', error.message); return json({ error: 'Could not load maintenance schedule.' }, 500); }
  const rows = (data || []).filter(r => r.cars?.is_active).map(withComputedStatus);
  return json({ items: rows });
}

export async function POST(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;
  const body = await req.json().catch(() => ({}));
  if (!body.car_id || !body.maintenance_type) return json({ error: 'Vehicle and maintenance type are required.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('car_maintenance').insert({
    car_id: body.car_id,
    maintenance_type: body.maintenance_type,
    last_service_km: Number(body.last_service_km || 0),
    interval_km: Number(body.interval_km || 10000),
    notes: body.notes || null,
  }).select().single();
  if (error) { console.error('[maintenance] create failed:', error.message); return json({ error: 'Could not add maintenance item.' }, 500); }
  return json({ item: data }, 201);
}
