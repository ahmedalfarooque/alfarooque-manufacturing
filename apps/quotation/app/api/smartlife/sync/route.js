'use strict';

/* Thin proxy to the central SmartLife sync engine (apps/crm/app/api/
   integrations/[key]/sync/route.js) — same pattern as apps/accounting/app/
   api/smartlife/sync/route.js. Quotation has no lib/smartlife.js (its own
   SmartLife master-data import lives in lib/smartlifeMasterData.js, a
   different concern), so the small cookie-forwarding helper is inlined here
   rather than added to that unrelated file. No sync logic lives here;
   lock/freshness/upsert all happen centrally. */

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');
const { parseCookies, COOKIE_NAME } = require('@/lib/auth');
const { SSO_COOKIE_NAME } = require('@/lib/sso');

function forwardedCookieHeader({ appToken, ssoToken }) {
  const parts = [];
  if (appToken) parts.push(`af_crm_session=${encodeURIComponent(appToken)}`);
  if (ssoToken) parts.push(`af_sso_session=${encodeURIComponent(ssoToken)}`);
  return parts.join('; ');
}

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
  const cookies = parseCookies(req.headers.get('cookie'));
  const cookieHeader = forwardedCookieHeader({
    appToken: cookies[COOKIE_NAME],
    ssoToken: cookies[SSO_COOKIE_NAME],
  });
  if (!cookieHeader) return json({ error: 'Authenticated ERP session is required.' }, 401);
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
