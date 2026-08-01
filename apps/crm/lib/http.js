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

module.exports = { json, requireSession };
