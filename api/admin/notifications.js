'use strict';

/* /api/admin/notifications
   GET   → latest notifications + unread count
   PATCH { action:'mark-read', id } | { action:'mark-all-read' }
   DELETE ?id=<uuid> */

const { getAdminClient } = require('../_supabaseAdmin');
const { requireAdminSession, readJsonBody } = require('../_adminAuth');

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  const sb = getAdminClient();
  const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);

  if (req.method === 'GET') {
    const { data } = await sb.from('admin_notifications').select('*').order('created_at', { ascending: false }).limit(50);
    const { count: unread } = await sb.from('admin_notifications').select('id', { count: 'exact', head: true }).eq('is_read', false);
    return res.status(200).json({ notifications: data || [], unread: unread || 0 });
  }

  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    if (body.action === 'mark-all-read') {
      await sb.from('admin_notifications').update({ is_read: true }).eq('is_read', false);
      return res.status(200).json({ ok: true });
    }
    if (body.action === 'mark-read' && body.id) {
      await sb.from('admin_notifications').update({ is_read: true }).eq('id', body.id);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Unknown action.' });
  }

  if (req.method === 'DELETE') {
    const id = query.id;
    if (!id) return res.status(400).json({ error: 'Missing notification id.' });
    await sb.from('admin_notifications').delete().eq('id', id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
