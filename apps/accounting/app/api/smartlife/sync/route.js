'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { parseCookies, COOKIE_NAME } = require('@/lib/auth');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;
  const { data, error } = await getDb().from('crm_integrations').select('status,last_sync_at,last_error').eq('tenant_id','alfarooque').eq('integration_key','smartlife').maybeSingle();
  if (error) return json({ error: 'Could not load SmartERP synchronization status.' }, 500);
  return json({ integration:data || null });
}

export async function POST(req) {
  const { response } = requireSession(req, { adminOnly:true });
  if (response) return response;
  const token = parseCookies(req.headers.get('cookie'))[COOKIE_NAME];
  const base = (process.env.SMARTERP_CENTRAL_API_URL || 'http://localhost:3060').trim();
  const upstream = await fetch(new URL('/api/integrations/smartlife/sync', base), {
    method:'POST', headers:{ Accept:'application/json', Cookie:`af_crm_session=${encodeURIComponent(token)}` }, cache:'no-store',
  });
  const payload = await upstream.json().catch(() => ({}));
  return json(payload, upstream.status);
}
