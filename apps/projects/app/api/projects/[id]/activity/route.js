'use strict';

/* Reads pm_project_logs — already written to by the existing project
   status-change code and by every new write route added in this
   feature (assignees, purchase requests, daily updates, documents).
   No new table needed for the "Activity" tab / timeline. */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb
    .from('pm_project_logs')
    .select('*')
    .eq('project_id', params.id)
    .order('created_at', { ascending: false });
  if (error) { console.error('[activity] list failed:', error.message); return json({ error: 'Could not load activity.' }, 500); }
  return json({ activity: data || [] });
}
