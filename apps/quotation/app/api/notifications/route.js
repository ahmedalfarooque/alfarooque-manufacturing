'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  try {
    const sb = getDb();
    /* Two sources merged into one feed: this app's own qt_notifications
       (its existing internal notifications), plus the shared
       public.notifications table used cross-app for the quotation <->
       projects handoff (Part 13) — same shape, just also carries a
       `type` so the UI can special-case quotation-request items. */
    const [own, shared] = await Promise.all([
      sb.from('qt_notifications').select('id, title, body, link, is_read, created_at')
        .eq('user_id', session.sub).order('created_at', { ascending: false }).limit(20),
      sb.from('notifications').select('id, type, title, body, link, is_read, created_at')
        .eq('user_id', session.sub).order('created_at', { ascending: false }).limit(20),
    ]);
    const notifications = [...(own.data || []), ...(shared.data || [])]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20);
    return json({ notifications, unread: notifications.filter(n => !n.is_read).length });
  } catch (_) {
    return json({ notifications: [], unread: 0 });
  }
}
