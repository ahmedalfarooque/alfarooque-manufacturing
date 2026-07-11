'use strict';

/* Delete a platform user. platform_users is shared across both apps, so a
   hard delete relies on the DB's own foreign-key constraints to reject the
   delete if the user still has associated records (quotations, audit logs,
   etc.) — we surface that as a friendly error rather than cascading. */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { isSuperAdminEmail } = require('@/lib/superAdmin');

export async function DELETE(req, { params }) {
  const { session, response } = requireSession(req, { adminOnly: true });
  if (!session) return response;
  if (params.id === session.sub) return json({ error: 'You cannot delete your own account.' }, 400);

  const sb = getDb();
  const { data: target } = await sb.from('platform_users').select('id, email').eq('id', params.id).maybeSingle();
  if (!target) return json({ error: 'User not found.' }, 404);
  if (isSuperAdminEmail(target.email) && !isSuperAdminEmail(session.email)) {
    return json({ error: 'This account cannot be deleted.' }, 403);
  }

  const { error } = await sb.from('platform_users').delete().eq('id', params.id);
  if (error) {
    if (error.code === '23503') return json({ error: 'Cannot delete: this user has associated records (quotations, roles, etc.). Deactivate instead.' }, 409);
    return json({ error: error.message }, 500);
  }
  return json({ ok: true });
}
