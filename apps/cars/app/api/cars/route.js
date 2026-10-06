'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { prepareVehicleValues, checkDates, DATE_ERRORS } = require('@/lib/vehicleInput');
const { isSchemaMissing } = require('@/lib/alertStore');

const SORTS = {
  latest: { column: 'last_update', ascending: false },
  oldest: { column: 'last_update', ascending: true },
  distance: { column: 'distance_km', ascending: false },
  name: { column: 'name', ascending: true },
};

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
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
  const pageSize = Math.min(500, Math.max(1, parseInt(q.get('pageSize') || '25', 10)));

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
  const { response, session } = await requireAction(req, 'add');
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
    insurance_company: body.insurance_company || null,
    insurance_number: body.insurance_number || null,
    insurance_expiry: body.insurance_expiry || null,
    registration_expiry: body.registration_expiry || null,
    vin_number: body.vin_number || null,
    engine_number: body.engine_number || null,
    last_service_date: body.last_service_date || null,
    next_service_date: body.next_service_date || null,
    assigned_driver_id: body.assigned_driver_id || null,
    purchase_date: body.purchase_date || null,
    purchase_cost: body.purchase_cost ? Number(body.purchase_cost) : null,
  };
  /* Insurance start / periodic inspection fields (migration v13). Blank
     values are simply not written, so adding a vehicle keeps working on a
     database that has not had v13 applied yet. */
  const { values: extra, touchesV13 } = prepareVehicleValues({
    insurance_start_date: body.insurance_start_date,
    periodic_inspection_last_date: body.periodic_inspection_last_date,
    periodic_inspection_expiry: body.periodic_inspection_expiry,
  }, null);
  Object.assign(row, extra);
  const bad = checkDates(row, null);
  if (bad) return json({ error: DATE_ERRORS[bad.code], code: bad.code, field: bad.field }, 400);

  const { data, error } = await sb.from('cars').insert(row).select().single();
  if (error) {
    if (touchesV13 && isSchemaMissing(error)) {
      return json({ error: 'Insurance start / periodic inspection fields need the database migration (apps-schema-v13) to be applied first.', code: 'SCHEMA_MISSING' }, 409);
    }
    console.error('[cars] create failed:', error.message);
    return json({ error: 'Could not add vehicle.' }, 500);
  }
  return json({ vehicle: data }, 201);
}
