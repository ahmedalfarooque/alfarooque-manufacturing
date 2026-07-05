'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();

  const { data: cars, error: carsErr } = await sb.from('cars').select('*').eq('is_active', true);
  if (carsErr) { console.error('[stats] cars failed:', carsErr.message); return json({ error: 'Could not load stats.' }, 500); }

  const total = cars.length;
  const byStatus = { Running: 0, Idle: 0, Stopped: 0, Offline: 0 };
  let totalDistance = 0;
  const drivers = new Set();
  for (const c of cars) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    totalDistance += Number(c.distance_km || 0);
    if (c.driver && c.driver !== '—') drivers.add(c.driver);
  }

  const { data: maint } = await sb.from('car_maintenance').select('*, cars!inner(current_km, is_active)').eq('cars.is_active', true);
  let dueCount = 0;
  const maintenanceDue = [];
  for (const m of maint || []) {
    const currentKm = Number(m.cars?.current_km || 0);
    const nextDue = Number(m.last_service_km) + Number(m.interval_km);
    const remaining = nextDue - currentKm;
    if (remaining <= Number(m.interval_km) * 0.1) {
      dueCount++;
      maintenanceDue.push({ id: m.id, car_id: m.car_id, maintenance_type: m.maintenance_type, next_due_km: nextDue, remaining_km: remaining });
    }
  }

  const { count: alertCount } = await sb.from('car_alerts').select('id', { count: 'exact', head: true }).eq('is_read', false);
  const { data: recentAlerts } = await sb.from('car_alerts').select('*').order('created_at', { ascending: false }).limit(5);
  const { data: recentTrips } = await sb.from('car_trips').select('*, cars(vehicle_number)').order('started_at', { ascending: false }).limit(5);
  const { data: log } = await sb.from('car_maintenance_log').select('cost');
  const fuelCost = 0; // no fuel_log table yet — surfaced as 0, not fabricated
  const maintenanceCost = (log || []).reduce((sum, r) => sum + Number(r.cost || 0), 0);

  const topByDistance = [...cars].sort((a, b) => Number(b.distance_km) - Number(a.distance_km)).slice(0, 5)
    .map(c => ({ vehicle_number: c.vehicle_number, distance_km: c.distance_km }));

  return json({
    totalVehicles: total,
    running: byStatus.Running, idle: byStatus.Idle, stopped: byStatus.Stopped, offline: byStatus.Offline,
    totalDrivers: drivers.size,
    totalDistance,
    maintenanceDueCount: dueCount,
    maintenanceDue: maintenanceDue.slice(0, 6),
    activeAlerts: alertCount || 0,
    recentAlerts: recentAlerts || [],
    recentTrips: recentTrips || [],
    maintenanceCost,
    fuelCost,
    statusBreakdown: byStatus,
    topByDistance,
  });
}
