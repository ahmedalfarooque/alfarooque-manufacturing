'use strict';

function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
}

/* Every mutating API route calls this first. Trusts the JWT's role
   claim (fast, no DB round-trip per request) — logout revokes the DB
   session row for audit/history, but a still-valid JWT keeps working
   until it expires (max 12h), which is an accepted tradeoff for a
   stateless-session design. Viewer role is blocked from every
   write/delete regardless of what the UI shows, so a viewer can never
   mutate data even by calling the API directly. */
const { readSession } = require('./auth');

function requireSession(req, { adminOnly } = {}) {
  const session = readSession(req);
  if (!session) return { response: json({ error: 'Not authenticated.' }, 401) };
  if (adminOnly && session.role !== 'admin') return { response: json({ error: 'Viewers cannot perform this action.' }, 403) };
  return { session };
}

/* Purchase Requests / Daily Updates can be created by an admin OR by a
   user assigned to that specific project (pm_project_assignees) — used
   by the write routes for those two modules. Admins always pass without
   a DB round-trip; only assignee membership needs a lookup. */
async function isAssignedOrAdmin(session, projectId) {
  if (!session) return false;
  if (session.role === 'admin') return true;
  const { getDb } = require('./db');
  const sb = getDb();
  const { data } = await sb
    .from('pm_project_assignees')
    .select('project_id')
    .eq('project_id', projectId)
    .eq('user_id', session.sub)
    .maybeSingle();
  return !!data;
}

module.exports = { json, requireSession, isAssignedOrAdmin };
