'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb
    .from('notifications')
    .select('*')
    .eq('user_id', session.sub)
    .order('created_at', { ascending: false })
    .limit(30);
  // Table only exists once apps-schema-v7.sql has been run — degrade to empty rather than error.
  if (error) return json({ notifications: [], unread: 0 });

  const notifications = data || [];
  return json({ notifications, unread: notifications.filter(n => !n.is_read).length });
}
