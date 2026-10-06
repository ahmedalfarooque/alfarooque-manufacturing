'use strict';

const { json, requireAction } = require('@/lib/http');
const { loadActiveVehicles, loadNotificationState, listRows, summarizeFleet, todayInZone } = require('@/lib/fleetData');

/* Insurance list — one row per active vehicle, computed by the shared
   expiry module (lib/fleetExpiry.js). The page filters/sorts client-side. */
export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  try {
    const [vehicles, state] = await Promise.all([loadActiveVehicles(), loadNotificationState()]);
    const today = todayInZone();
    return json({
      today, schemaReady: state.ready,
      summary: summarizeFleet(vehicles, { today }).insurance,
      rows: listRows(vehicles, 'insurance', state, today),
    });
  } catch (e) {
    console.error('[insurance] list failed:', e.cause?.message || e.message);
    return json({ error: 'Could not load insurance data.' }, 500);
  }
}
