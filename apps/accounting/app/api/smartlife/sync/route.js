'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { parseCookies, COOKIE_NAME } = require('@/lib/auth');
const { SSO_COOKIE_NAME } = require('@/lib/sso');
const { forwardedCookieHeader } = require('@/lib/smartlife');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const { data, error } = await getDb().from('crm_integrations').select('status,last_sync_at,last_error').eq('tenant_id','alfarooque').eq('integration_key','smartlife').maybeSingle();
  if (error) return json({ error: 'Could not load SmartERP synchronization status.' }, 500);
  return json({ integration:data || null });
}

export async function POST(req) {
  const { response } = await requireAction(req, 'add');
  if (response) return response;
  /* Same credential rule as the resource read route: forward the app cookie
     and/or the parent-domain SSO cookie, since requireSession accepts either.
     Forwarding only the app cookie broke Refresh/Sync for an admin signed in
     through a sibling app. */
  const cookies = parseCookies(req.headers.get('cookie'));
  const cookieHeader = forwardedCookieHeader({
    appToken: cookies[COOKIE_NAME],
    ssoToken: cookies[SSO_COOKIE_NAME],
  });
  if (!cookieHeader) return json({ error: 'Authenticated ERP session is required.' }, 401);
  /* `trigger` distinguishes an explicit user click (the existing "Refresh /
     Sync" button — always runs, matching prior behavior exactly) from the
     new automatic background trigger fired once per tab on login (see
     components/Shell.js) — the central route below only applies its
     recent-sync skip to the 'background' trigger, never to a manual click. */
  const body = await req.json().catch(() => ({}));
  const trigger = body?.trigger === 'background' ? 'background' : 'manual';
  const base = (process.env.SMARTERP_CENTRAL_API_URL || 'http://localhost:3060').trim();
  const upstream = await fetch(new URL('/api/integrations/smartlife/sync', base), {
    method:'POST', headers:{ Accept:'application/json', 'Content-Type':'application/json', Cookie: cookieHeader }, cache:'no-store',
    body: JSON.stringify({ trigger }),
  });
  const payload = await upstream.json().catch(() => ({}));
  return json(payload, upstream.status);
}
