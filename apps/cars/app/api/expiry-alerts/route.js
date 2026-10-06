'use strict';

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');
const { loadActiveVehicles, loadNotificationState, notificationFor, collectAlerts, summarizeFleet, buildVehicleExpiry, todayInZone } = require('@/lib/fleetData');
const { isSchemaMissing } = require('@/lib/alertStore');

/* Central expiry-alert feed for the Alerts page: every ACTIVE alert
   (expiring within 30 days, or expired) for insurance and inspection,
   plus the resolved history when migration v13 is in place. Same
   calculation as the dashboard and the vehicle pages. */
export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  try {
    const sb = getDb();
    const [vehicles, state] = await Promise.all([loadActiveVehicles(sb), loadNotificationState(sb)]);
    const today = todayInZone();
    const byId = new Map(vehicles.map(v => [v.id, v]));
    const alerts = collectAlerts(vehicles, { today }).map(a => {
      const rec = buildVehicleExpiry(byId.get(a.carId), { today })[a.alertType];
      return { ...a, notification: notificationFor(state, a.carId, rec) };
    });

    let resolved = [];
    if (state.ready) {
      const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await sb.from('car_expiry_alerts')
        .select('id, car_id, alert_type, expiry_date, first_detected_on, last_sent_on, resolved_on, resolved_reason, cars(vehicle_number, name)')
        .eq('state', 'resolved').gte('resolved_on', since).order('resolved_on', { ascending: false }).limit(200);
      if (error && !isSchemaMissing(error)) throw error;
      resolved = (data || []).map(r => ({
        id: r.id, carId: r.car_id, vehicleNumber: r.cars?.vehicle_number || null, vehicleName: r.cars?.name || null,
        alertType: r.alert_type, expiryDate: String(r.expiry_date).slice(0, 10), firstDetectedOn: r.first_detected_on,
        lastSentOn: r.last_sent_on, resolvedOn: r.resolved_on, resolvedReason: r.resolved_reason,
      }));
    }
    const summary = summarizeFleet(vehicles, { today });
    return json({ today, schemaReady: state.ready, alerts, resolved, severity: summary.severity, activeAlertCount: summary.activeAlertCount });
  } catch (e) {
    console.error('[expiry-alerts] failed:', e.cause?.message || e.message);
    return json({ error: 'Could not load expiry alerts.' }, 500);
  }
}
