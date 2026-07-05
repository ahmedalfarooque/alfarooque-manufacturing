'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const url = new URL(req.url);
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10));
  const { data, error } = await sb.from('car_alerts').select('*, cars(vehicle_number)').order('created_at', { ascending: false }).limit(limit);
  if (error) { console.error('[alerts] list failed:', error.message); return json({ error: 'Could not load alerts.' }, 500); }
  return json({ alerts: data || [] });
}

export async function PATCH(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const body = await req.json().catch(() => ({}));
  if (!body.id) return json({ error: 'Alert id is required.' }, 400);
  const sb = getDb();
  const { error } = await sb.from('car_alerts').update({ is_read: true }).eq('id', body.id);
  if (error) return json({ error: 'Could not update alert.' }, 500);
  return json({ ok: true });
}
