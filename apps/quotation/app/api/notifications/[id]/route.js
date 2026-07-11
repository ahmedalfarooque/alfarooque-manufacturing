'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function PATCH(req, { params }) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  try {
    const sb = getDb();
    /* The notification could be from either source table (Part 13) —
       try both; whichever one actually has this id updates, the other
       affects 0 rows harmlessly. */
    await Promise.all([
      sb.from('qt_notifications').update({ is_read: true }).eq('id', params.id).eq('user_id', session.sub),
      sb.from('notifications').update({ is_read: true }).eq('id', params.id).eq('user_id', session.sub),
    ]);
  } catch (_) {}
  return json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  try {
    const sb = getDb();
    await Promise.all([
      sb.from('qt_notifications').delete().eq('id', params.id).eq('user_id', session.sub),
      sb.from('notifications').delete().eq('id', params.id).eq('user_id', session.sub),
    ]);
  } catch (_) {}
  return json({ ok: true });
}
