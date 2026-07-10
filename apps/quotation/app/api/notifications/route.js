'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  try {
    const sb = getDb();
    const { data, error } = await sb.from('qt_notifications')
      .select('id, title, body, link, is_read, created_at')
      .eq('user_id', session.sub)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return json({ notifications: [], unread: 0 });
    const notifications = data || [];
    return json({ notifications, unread: notifications.filter(n => !n.is_read).length });
  } catch (_) {
    return json({ notifications: [], unread: 0 });
  }
}
