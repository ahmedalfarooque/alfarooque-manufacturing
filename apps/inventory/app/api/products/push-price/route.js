'use strict';

/* Pushes an operational item's current price into its linked QuotePro
   Material's `latest_price` — by calling QuotePro's OWN existing PATCH
   /api/materials/[id] endpoint (cross-app, SSO-cookie-forwarded), never
   by writing to qt_materials directly from here. That endpoint already
   appends qt_material_price_history when latest_price changes (see
   apps/quotation/app/api/materials/[id]/route.js afterUpdate) — reusing
   it means QuotePro's price history is preserved exactly as it always
   has been; nothing here reimplements or bypasses that. This is an
   explicit admin action, never automatic — matches "use evidence/
   business action, don't auto-create for every purchase". */

const { json, requireAction } = require('@/lib/http');
const { parseCookies } = require('@/lib/auth');
const { SSO_COOKIE_NAME } = require('@/lib/sso');

function quotationBase() { return (process.env.QUOTATION_API_URL || 'http://localhost:3030').replace(/\/$/, ''); }

export async function POST(req) {
  const { response } = await requireAction(req, 'edit');
  if (response) return response;
  const body = await req.json().catch(() => ({}));
  const qtMaterialId = String(body.qt_material_id || '').trim();
  const price = Number(body.price);
  if (!qtMaterialId) return json({ error: 'qt_material_id is required.' }, 400);
  if (!Number.isFinite(price) || price < 0) return json({ error: 'A valid price is required.' }, 400);

  const ssoToken = parseCookies(req.headers.get('cookie'))[SSO_COOKIE_NAME];
  if (!ssoToken) return json({ error: 'An active AL FAROOQUE single sign-on session is required to update QuotePro. Log in via the shared session and retry.' }, 401);

  try {
    const res = await fetch(`${quotationBase()}/api/materials/${qtMaterialId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: `${SSO_COOKIE_NAME}=${ssoToken}` },
      body: JSON.stringify({ latest_price: price }),
      cache: 'no-store',
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: payload.error || `QuotePro returned HTTP ${res.status}.` }, res.status === 401 || res.status === 403 ? res.status : 502);
    return json({ material: payload.row });
  } catch (_) {
    return json({ error: 'Could not reach QuotePro.' }, 502);
  }
}
