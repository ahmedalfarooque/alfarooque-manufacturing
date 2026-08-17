'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const PAGE_SIZE = 50;

export async function GET(req) {
  const { session, response } = requireSession(req, { adminOnly: true });
  if (!session) return response;
  const sb = getDb();
  const url = new URL(req.url);
  const table = url.searchParams.get('table') || '';
  const action = url.searchParams.get('action') || '';
  const dateFrom = url.searchParams.get('from') || '';
  const dateTo = url.searchParams.get('to') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  let q = sb.from('qt_audit_logs').select('*', { count: 'exact' });
  if (table) q = q.eq('table_name', table);
  if (action) q = q.eq('action', action);
  /* created_at is a timestamp, not a plain date — the upper bound must
     include the entire local calendar day, not just its midnight instant,
     or records from later that day would be silently dropped. */
  if (dateFrom) q = q.gte('created_at', dateFrom);
  if (dateTo) q = q.lte('created_at', `${dateTo}T23:59:59.999`);
  q = q.order('created_at', { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
  const { data, count, error } = await q;
  if (error) return json({ error: error.message }, 500);

  /* attach actor emails */
  const actorIds = [...new Set((data || []).map(r => r.actor_id).filter(Boolean))];
  let actors = new Map();
  if (actorIds.length) {
    const { data: users } = await sb.from('platform_users').select('id, email').in('id', actorIds);
    actors = new Map((users || []).map(u => [u.id, u.email]));
  }
  return json({
    rows: (data || []).map(r => ({ ...r, actor_email: actors.get(r.actor_id) || null })),
    total: count || 0, page, pageSize: PAGE_SIZE,
  });
}
