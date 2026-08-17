'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const url = new URL(req.url);
  const q = url.searchParams;
  /* Raised from 100 to 1000 so the list page's date-range filter and
     page-size selector (up to 500 rows/page) can operate over the
     complete recent dataset instead of silently truncating it. */
  const limit = Math.min(1000, parseInt(q.get('limit') || '50', 10));
  const dateFrom = q.get('dateFrom') || '';
  const dateTo = q.get('dateTo') || '';
  let query = sb.from('car_alerts').select('*, cars(vehicle_number)').order('created_at', { ascending: false });
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59.999');
  query = query.limit(limit);
  const { data, error } = await query;
  if (error) { console.error('[alerts] list failed:', error.message); return json({ error: 'Could not load alerts.' }, 500); }
  return json({ alerts: data || [] });
}

export async function PATCH(req) {
  const { response } = await requireAction(req, 'edit');
  if (response) return response;
  const body = await req.json().catch(() => ({}));
  if (!body.id) return json({ error: 'Alert id is required.' }, 400);
  const sb = getDb();
  const { error } = await sb.from('car_alerts').update({ is_read: true }).eq('id', body.id);
  if (error) return json({ error: 'Could not update alert.' }, 500);
  return json({ ok: true });
}
