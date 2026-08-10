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

async function requireDelete(req) {
  const session = readSession(req);
  if (!session) return { response: json({ error: 'Not authenticated.' }, 401) };
  const { getDb } = require('./db');
  const { getDeleteAuthorization } = require('../../shared/authorization');
  const authorization = await getDeleteAuthorization(getDb(), session, 'inventory');
  if (!authorization.allowed) return { response: json({ error: 'Delete permission required.' }, 403) };
  return { session, authorization };
}

module.exports = { json, requireSession, requireDelete };
