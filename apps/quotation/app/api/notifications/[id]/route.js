'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function PATCH(req, { params }) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  try {
    const sb = getDb();
    await sb.from('qt_notifications')
      .update({ is_read: true })
      .eq('id', params.id)
      .eq('user_id', session.sub);
  } catch (_) {}
  return json({ ok: true });
}
