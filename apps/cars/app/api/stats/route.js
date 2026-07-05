'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { expiryInfo } = require('@/lib/expiry');

const EXPIRY_CATEGORIES = [
  { key: 'license', label: 'License', table: 'driver', field: 'license_expiry_date' },
  { key: 'iqama', label: 'Iqama', table: 'driver', field: 'iqama_expiry_date' },
  { key: 'passport', label: 'Passport', table: 'driver', field: 'passport_expiry_date' },
  { key: 'medical', label: 'Medical', table: 'driver', field: 'medical_expiry_date' },
  { key: 'insurance', label: 'Insurance', table: 'vehicle', field: 'insurance_expiry' },
  { key: 'registration', label: 'Registration', table: 'vehicle', field: 'registration_expiry' },
];

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();

  const { data: cars, error: carsErr } = await sb.from('cars').select('*').eq('is_active', true);
  if (carsErr) { console.error('[stats] cars failed:', carsErr.message); return json({ error: 'Could not load stats.' }, 500); }
  const { data: driverRows } = await sb.from('drivers').select('id, full_name, status, license_expiry_date, iqama_expiry_date, passport_expiry_date, medical_expiry_date');

  const total = cars.length;
  const byStatus = { Running: 0, Idle: 0, Stopped: 0, Offline: 0 };
  const byType = {};
  let totalDistance = 0;
  const drivers = new Set();
  for (const c of cars) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
    byType[c.type || 'Other'] = (byType[c.type || 'Other'] || 0) + 1;
    totalDistance += Number(c.distance_km || 0);
    if (c.driver && c.driver !== '—') drivers.add(c.driver);
  }

  const driverStatusBreakdown = { Active: 0, Inactive: 0, 'On Leave': 0, Terminated: 0 };
  for (const d of driverRows || []) driverStatusBreakdown[d.status] = (driverStatusBreakdown[d.status] || 0) + 1;

  /* Expiry summary + notification feed, driven entirely by real driver/vehicle
     rows — same green/yellow/orange/red thresholds as the detail pages
     (lib/expiry.js), so the dashboard can never disagree with them. */
  const levelCounts = {};
  const notifications = [];
  for (const cat of EXPIRY_CATEGORIES) {
    levelCounts[cat.key] = { green: 0, yellow: 0, orange: 0, red: 0, none: 0 };
    const rows = cat.table === 'driver' ? (driverRows || []) : cars;
    for (const row of rows) {
      const info = expiryInfo(row[cat.field]);
      levelCounts[cat.key][info.level]++;
      if (info.level === 'orange' || info.level === 'red') {
        notifications.push({
          category: cat.label,
          level: info.level,
          label: info.label,
          days: info.days,
          entityId: row.id,
          entityName: cat.table === 'driver' ? row.full_name : row.vehicle_number,
          href: cat.table === 'driver' ? `/drivers/${row.id}` : `/vehicles/${row.id}`,
        });
      }
    }
  }
  notifications.sort((a, b) => a.days - b.days);

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
  const maintenanceCost = (log || []).reduce((sum, r) => sum + Number(r.cost || 0), 0);

  const { data: allTrips, count: totalTrips } = await sb.from('car_trips').select('distance_km, duration_min', { count: 'exact' });
  /* Avg speed is computed from real logged trips (distance/duration) —
     "—" (not a fabricated number) until at least one trip exists. */
  let avgSpeed = null;
  if (allTrips && allTrips.length) {
    const speeds = allTrips
      .filter(t => Number(t.distance_km) > 0 && Number(t.duration_min) > 0)
      .map(t => Number(t.distance_km) / (Number(t.duration_min) / 60));
    if (speeds.length) avgSpeed = Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 10) / 10;
  }

  const { data: fuelRows } = await sb.from('fuel_log').select('liters, cost');
  const fuelConsumed = (fuelRows || []).reduce((sum, r) => sum + Number(r.liters || 0), 0);
  const fuelCost = (fuelRows || []).reduce((sum, r) => sum + Number(r.cost || 0), 0);

  const topByDistance = [...cars].sort((a, b) => Number(b.distance_km) - Number(a.distance_km)).slice(0, 5)
    .map(c => ({ vehicle_number: c.vehicle_number, distance_km: c.distance_km }));

  /* Upsert today's fleet-status snapshot so the "Real Time Vehicle
     Status" chart has a genuine history to plot — there is no live GPS
     feed in this deployment, so the only honest way to build that
     history is to record the real status breakdown each time the
     dashboard is actually viewed, rather than inventing points. */
  const today = new Date().toISOString().slice(0, 10);
  await sb.from('car_status_snapshots').upsert(
    { snapshot_date: today, running: byStatus.Running, idle: byStatus.Idle, stopped: byStatus.Stopped, offline: byStatus.Offline },
    { onConflict: 'snapshot_date' }
  );
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: statusHistory } = await sb.from('car_status_snapshots')
    .select('*').gte('snapshot_date', sevenDaysAgo).order('snapshot_date', { ascending: true });

  /* Maintenance module (rich job records — distinct from the
     car_maintenance schedule above and the old car_maintenance_log). */
  const { data: records } = await sb.from('car_maintenance_records')
    .select('*, cars(vehicle_number), maintenance_shops(name)').order('maintenance_date', { ascending: false });
  const allRecords = records || [];
  const now = new Date();
  const monthStart = now.toISOString().slice(0, 7);
  const yearStart = String(now.getFullYear());
  const totalRecordsCost = allRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const thisMonthCost = allRecords.filter(r => r.maintenance_date?.slice(0, 7) === monthStart).reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const thisYearCost = allRecords.filter(r => r.maintenance_date?.slice(0, 4) === yearStart).reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const today10 = now.toISOString().slice(0, 10);
  /* "In workshop" has no explicit status column on a record — the honest
     proxy is a vehicle with a job dated today (being worked on right now). */
  const vehiclesInWorkshop = new Set(allRecords.filter(r => r.maintenance_date === today10).map(r => r.car_id)).size;

  const shopTotals = {};
  for (const r of allRecords) {
    if (!r.shop_id) continue;
    const key = r.shop_id;
    shopTotals[key] = shopTotals[key] || { name: r.maintenance_shops?.name || 'Unknown', count: 0, cost: 0 };
    shopTotals[key].count++;
    shopTotals[key].cost += Number(r.amount || 0);
  }
  const topShops = Object.values(shopTotals).sort((a, b) => b.cost - a.cost).slice(0, 5);

  const vehicleTotals = {};
  for (const r of allRecords) {
    const key = r.car_id;
    vehicleTotals[key] = vehicleTotals[key] || { name: r.cars?.vehicle_number || 'Unknown', cost: 0 };
    vehicleTotals[key].cost += Number(r.amount || 0);
  }
  const costByVehicle = Object.values(vehicleTotals).sort((a, b) => b.cost - a.cost).slice(0, 5);

  const monthlyCost = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthlyCost[d.toISOString().slice(0, 7)] = 0;
  }
  for (const r of allRecords) {
    const m = r.maintenance_date?.slice(0, 7);
    if (m in monthlyCost) monthlyCost[m] += Number(r.amount || 0);
  }
  const monthlyMaintenanceCost = Object.entries(monthlyCost).map(([month, cost]) => ({ month, cost }));

  const categoryCounts = {};
  for (const r of allRecords) categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
  const categoryBreakdown = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));

  const recentMaintenanceActivity = allRecords.slice(0, 5).map(r => ({
    id: r.id, vehicle_number: r.cars?.vehicle_number, category: r.category, amount: r.amount,
    currency: r.currency, maintenance_date: r.maintenance_date,
  }));

  const upcomingServices = maintenanceDue.filter(m => m.remaining_km > 0).length;
  const overdueServices = maintenanceDue.filter(m => m.remaining_km <= 0).length;

  return json({
    totalVehicles: total,
    running: byStatus.Running, idle: byStatus.Idle, stopped: byStatus.Stopped, offline: byStatus.Offline,
    totalDrivers: (driverRows || []).length || drivers.size,
    totalDistance,
    totalTrips: totalTrips || 0,
    avgSpeed,
    fuelConsumed,
    maintenanceDueCount: dueCount,
    maintenanceDue: maintenanceDue.slice(0, 6),
    activeAlerts: alertCount || 0,
    recentAlerts: recentAlerts || [],
    recentTrips: recentTrips || [],
    maintenanceCost,
    fuelCost,
    statusBreakdown: byStatus,
    typeBreakdown: byType,
    driverStatusBreakdown,
    topByDistance,
    statusHistory: statusHistory || [],
    expiryLevelCounts: levelCounts,
    notifications: notifications.slice(0, 20),
    totalMaintenanceRecords: allRecords.length,
    totalMaintenanceRecordsCost: totalRecordsCost,
    thisMonthMaintenanceCost: thisMonthCost,
    thisYearMaintenanceCost: thisYearCost,
    upcomingServices,
    overdueServices,
    vehiclesInWorkshop,
    topShops,
    costByVehicle,
    monthlyMaintenanceCost,
    categoryBreakdown,
    recentMaintenanceActivity,
  });
}
