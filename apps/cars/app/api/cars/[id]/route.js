'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, requireDelete , requireAction } = require('@/lib/http');
const { prepareVehicleValues, checkDates, DATE_ERRORS } = require('@/lib/vehicleInput');
const { loadNotificationState, notificationFor, todayInZone, buildVehicleExpiry } = require('@/lib/fleetData');
const { isSchemaMissing } = require('@/lib/alertStore');

const EDITABLE = ['vehicle_number', 'name', 'make', 'model', 'year', 'color', 'serial_number',
  'type', 'fuel_type', 'driver', 'status', 'condition_status', 'oil_type', 'oil_viscosity',
  'oil_capacity_l', 'current_km', 'distance_km', 'location', 'notes',
  'insurance_company', 'insurance_number', 'insurance_expiry', 'insurance_start_date', 'registration_expiry',
  'periodic_inspection_last_date', 'periodic_inspection_expiry',
  'vin_number', 'engine_number', 'last_service_date', 'next_service_date',
  'assigned_driver_id', 'purchase_date', 'purchase_cost'];

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const sb = getDb();
  const { data: vehicle, error } = await sb.from('cars').select('*, drivers!cars_assigned_driver_id_fkey(id, full_name, phone)').eq('id', params.id).maybeSingle();
  if (error) { console.error('[cars] get failed:', error.message); return json({ error: 'Could not load vehicle.' }, 500); }
  if (!vehicle) return json({ error: 'Vehicle not found.' }, 404);

  const [maintenance, maintenanceLog, trips, alerts, state] = await Promise.all([
    sb.from('car_maintenance').select('*').eq('car_id', params.id),
    sb.from('car_maintenance_log').select('*').eq('car_id', params.id).order('service_date', { ascending: false }).limit(10),
    sb.from('car_trips').select('*').eq('car_id', params.id).order('started_at', { ascending: false }).limit(10),
    sb.from('car_alerts').select('*').eq('car_id', params.id).order('created_at', { ascending: false }).limit(10),
    loadNotificationState(sb).catch(() => ({ ready: false, settings: null, recipientCount: 0, byKey: new Map() })),
  ]);

  /* Expiry picture from the same module the dashboard and lists use, so
     this card can never disagree with them. */
  const today = todayInZone();
  const e = buildVehicleExpiry(vehicle, { today });
  const withNotification = rec => ({ ...rec, notification: notificationFor(state, vehicle.id, rec) });
  const maintenanceAlerts = (maintenance.data || []).map(m => {
    const remainingKm = Number(m.last_service_km) + Number(m.interval_km) - Number(vehicle.current_km || 0);
    return { id: m.id, maintenanceType: m.maintenance_type, remainingKm, due: remainingKm <= Number(m.interval_km) * 0.1, overdue: remainingKm <= 0 };
  }).filter(m => m.due);

  return json({
    vehicle,
    maintenance: maintenance.data || [],
    maintenanceLog: maintenanceLog.data || [],
    trips: trips.data || [],
    alerts: alerts.data || [],
    expiry: { today, schemaReady: state.ready, insurance: withNotification(e.insurance), inspection: withNotification(e.inspection), maintenanceAlerts },
  });
}

export async function PATCH(req, { params }) {
  const { response } = await requireAction(req, 'edit');
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const input = {};
  for (const key of EDITABLE) if (key in body) input[key] = body[key];
  if (Object.keys(input).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const sb = getDb();
  const { data: existing, error: loadErr } = await sb.from('cars').select('*').eq('id', params.id).maybeSingle();
  if (loadErr) { console.error('[cars] update lookup failed:', loadErr.message); return json({ error: 'Could not update vehicle.' }, 500); }
  if (!existing) return json({ error: 'Vehicle not found.' }, 404);

  const { values: patch, touchesV13 } = prepareVehicleValues(input, existing);
  const bad = checkDates(patch, existing);
  if (bad) return json({ error: DATE_ERRORS[bad.code], code: bad.code, field: bad.field }, 400);
  if (Object.keys(patch).length === 0) return json({ vehicle: existing });
  patch.last_update = new Date().toISOString();

  const { data, error } = await sb.from('cars').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) {
    if (touchesV13 && isSchemaMissing(error)) {
      return json({ error: 'Insurance start / periodic inspection fields need the database migration (apps-schema-v13) to be applied first.', code: 'SCHEMA_MISSING' }, 409);
    }
    console.error('[cars] update failed:', error.message);
    return json({ error: 'Could not update vehicle.' }, 500);
  }
  if (!data) return json({ error: 'Vehicle not found.' }, 404);
  return json({ vehicle: data });
}

export async function DELETE(req, { params }) {
  const { response } = await requireDelete(req);
  if (response) return response;

  const sb = getDb();
  const { error } = await sb.from('cars').update({ is_active: false }).eq('id', params.id);
  if (error) { console.error('[cars] delete failed:', error.message); return json({ error: 'Could not delete vehicle.' }, 500); }
  return json({ ok: true });
}
