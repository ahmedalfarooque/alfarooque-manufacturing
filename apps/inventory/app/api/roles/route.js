'use strict';

const { json, requireSession , requireAction } = require('@/lib/http');
const { getInvRole, ROLES, PERMS } = require('@/lib/perms');
const { getDb } = require('@/lib/db');

export async function GET(req) {
  const { response, session } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const invRole = await getInvRole(sb, session);
  return json({
    my_role: invRole,
    roles: ROLES,
    permissions: PERMS,
  });
}
