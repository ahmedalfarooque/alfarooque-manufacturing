'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function PATCH(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const sb = getDb();
  const { data, error } = await sb
    .from('notifications')
    .update({ is_read: body.is_read !== false })
    .eq('id', params.id)
    .eq('user_id', session.sub) // a user can only mark their own notifications read
    .select()
    .maybeSingle();
  if (error) { console.error('[notifications] update failed:', error.message); return json({ error: 'Could not update notification.' }, 500); }
  if (!data) return json({ error: 'Notification not found.' }, 404);
  return json({ notification: data });
}
