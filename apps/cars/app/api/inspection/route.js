'use strict';

const { json, requireAction } = require('@/lib/http');
const { loadActiveVehicles, loadNotificationState, listRows, summarizeFleet, todayInZone } = require('@/lib/fleetData');

/* Periodic Vehicle Inspection list — same shape/logic as /api/insurance.
   `inspectionColumnsExist` is false until migration v13 adds the columns;
   the page then says so instead of silently showing "Not set" everywhere. */
export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  try {
    const [vehicles, state] = await Promise.all([loadActiveVehicles(), loadNotificationState()]);
    const today = todayInZone();
    const inspectionColumnsExist = vehicles.length === 0 || vehicles.some(v => 'periodic_inspection_expiry' in v);
    return json({
      today, schemaReady: state.ready && inspectionColumnsExist, inspectionColumnsExist,
      summary: summarizeFleet(vehicles, { today }).inspection,
      rows: listRows(vehicles, 'inspection', state, today),
    });
  } catch (e) {
    console.error('[inspection] list failed:', e.cause?.message || e.message);
    return json({ error: 'Could not load inspection data.' }, 500);
  }
}
