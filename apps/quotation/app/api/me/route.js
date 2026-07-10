'use strict';

/* Current user's quotation-app role + permissions (drives UI gating). */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getQRole, PERMS } = require('@/lib/perms');

export async function GET(req) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const qrole = await getQRole(getDb(), session);
  return json({ user: { id: session.sub, email: session.email, role: session.role }, qrole, perms: PERMS[qrole] || [] });
}
