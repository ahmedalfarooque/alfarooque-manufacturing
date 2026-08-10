'use strict';

const { readSession } = require('./auth');

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function requireSession(req, opts = {}) {
  const session = readSession(req);
  if (!session) return { response: json({ error: 'Unauthorized.' }, 401) };
  if (opts.adminOnly && session.role !== 'admin') {
    return { response: json({ error: 'Admin access required.' }, 403) };
  }
  if (opts.roles && !opts.roles.includes(session.role)) {
    return { response: json({ error: 'Insufficient permissions.' }, 403) };
  }
  return { session };
}

async function requireDelete(req) {
  const session = readSession(req);
  if (!session) return { response: json({ error: 'Unauthorized.' }, 401) };
  const { getDb } = require('./db');
  const { getDeleteAuthorization } = require('../../shared/authorization');
  const authorization = await getDeleteAuthorization(getDb(), session, 'crm');
  if (!authorization.allowed) return { response: json({ error: 'Delete permission required.' }, 403) };
  return { session, authorization };
}

module.exports = { json, requireSession, requireDelete };
