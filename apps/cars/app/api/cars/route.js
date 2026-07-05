'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const SORTS = {
  latest: { column: 'last_update', ascending: false },
  oldest: { column: 'last_update', ascending: true },
  distance: { column: 'distance_km', ascending: false },
  name: { column: 'name', ascending: true },
};

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const q = url.searchParams;
  const search = (q.get('search') || '').trim();
  const status = q.get('status') || 'All';
  const type = q.get('type') || 'All';
  const fuelType = q.get('fuelType') || 'All';
  const assignment = q.get('assignment') || 'All'; // Assigned|Unassigned|All
  const sort = SORTS[q.get('sort')] || SORTS.latest;
  const page = Math.max(1, parseInt(q.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(q.get('pageSize') || '10', 10)));

  const sb = getDb();
  let query = sb.from('cars').select('*', { count: 'exact' }).eq('is_active', true);
  if (search) query = query.or(`vehicle_number.ilike.%${search}%,name.ilike.%${search}%,driver.ilike.%${search}%`);
  if (status !== 'All') query = query.eq('status', status);
  if (type !== 'All') query = query.eq('type', type);
  if (fuelType !== 'All') query = query.eq('fuel_type', fuelType);
  if (assignment === 'Assigned') query = query.not('driver', 'is', null).neq('driver', '');
  if (assignment === 'Unassigned') query = query.or('driver.is.null,driver.eq.');

  query = query.order(sort.column, { ascending: sort.ascending })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) { console.error('[cars] list failed:', error.message); return json({ error: 'Could not load vehicles.' }, 500); }
  return json({ vehicles: data, total: count || 0, page, pageSize });
}

export async function POST(req) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const vehicleNumber = String(body.vehicle_number || '').trim();
  if (!vehicleNumber) return json({ error: 'Vehicle number is required.' }, 400);

  const sb = getDb();
  const { data: existing } = await sb.from('cars').select('id').eq('vehicle_number', vehicleNumber).maybeSingle();
  if (existing) return json({ error: 'A vehicle with this number already exists.' }, 409);

  const row = {
    vehicle_number: vehicleNumber,
    name: body.name || null,
    make: body.make || null,
    model: body.model || null,
    year: body.year ? parseInt(body.year, 10) : null,
    color: body.color || null,
    serial_number: body.serial_number || null,
    type: body.type || 'Vehicle',
    fuel_type: body.fuel_type || 'Diesel',
    driver: body.driver || null,
    status: body.status || 'Idle',
    condition_status: body.condition_status || 'Valid',
    oil_type: body.oil_type || null,
    oil_viscosity: body.oil_viscosity || null,
    oil_capacity_l: body.oil_capacity_l ? Number(body.oil_capacity_l) : null,
    current_km: body.current_km ? Number(body.current_km) : 0,
    distance_km: body.distance_km ? Number(body.distance_km) : 0,
    location: body.location || null,
    notes: body.notes || null,
  };
  const { data, error } = await sb.from('cars').insert(row).select().single();
  if (error) { console.error('[cars] create failed:', error.message); return json({ error: 'Could not add vehicle.' }, 500); }
  return json({ vehicle: data }, 201);
}
