'use strict';

/* Cross-app single sign-on (SSO) core — shared by QuotePro, Projects,
   Car Inventory, and this Inventory app (ERP-style module switching).
   Mirrored file: apps/quotation/lib/sso.js · apps/projects/lib/sso.js ·
   apps/cars/lib/sso.js · apps/inventory/lib/sso.js — keep identical.

   Design:
   - On a successful login any authenticated user gets, alongside their
     own app session cookie, one extra JWT cookie (af_sso_session) scoped
     to the parent domain (.alfarooque.com). This lets any authenticated
     user switch between apps without re-logging in (ERP-wide SSO).
   - Each app checks its own cookie FIRST and only falls back to the SSO
     cookie. The SSO payload must carry sso:true — a plain app session
     token pasted into the SSO cookie is rejected.
   - Permissions in each app are still gated by that app's own role table
     (inv_user_roles, qt_user_roles, etc.). SSO provides authentication
     only; authorization is always local to the app.
   - Admin logout clears the SSO cookie + all four session cookies. */

const jwt = require('jsonwebtoken');

const SSO_COOKIE_NAME = 'af_sso_session';
const APP_COOKIE_NAMES = ['af_quotation_session', 'af_projects_session', 'af_cars_session', 'af_inventory_session'];
const SSO_TTL_SECONDS = 12 * 60 * 60; // matches each app's own session TTL

function ssoSecret() {
  const s = process.env.SSO_JWT_SECRET || process.env.JWT_SECRET;
  if (!s) throw new Error('SSO_JWT_SECRET / JWT_SECRET is not configured.');
  return s;
}

/* Called for any authenticated user — mints an SSO token with their
   actual role so they can switch apps without re-logging in. */
function signSsoSession(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, sso: true },
    ssoSecret(),
    { expiresIn: SSO_TTL_SECONDS }
  );
}

/* Returns the payload for any valid SSO token (any role) — wrong
   signature, expired, or a regular app session token all yield null. */
function verifySsoSession(token) {
  try {
    const p = jwt.verify(token, ssoSecret());
    if (!p || p.sso !== true) return null;
    return p;
  } catch (_) { return null; }
}

/* Cookie Domain for the current request — no hardcoded hostnames:
   - AF_COOKIE_DOMAIN env wins when set (explicit configuration).
   - localhost / raw IPs / *.vercel.app previews → null (host-only
     cookie; localhost still shares cookies across ports).
   - anything.example.com → .example.com (parent registrable domain). */
function cookieDomainForHost(hostHeader) {
  if (process.env.AF_COOKIE_DOMAIN) return process.env.AF_COOKIE_DOMAIN;
  const host = String(hostHeader || '').split(':')[0].toLowerCase();
  if (!host || host === 'localhost' || /^[0-9.]+$/.test(host) || host.endsWith('.vercel.app')) return null;
  const labels = host.split('.');
  if (labels.length < 2) return null;
  return '.' + labels.slice(-2).join('.');
}

function cookieDomainFromReq(req) {
  const h = req.headers.get ? req.headers.get('host') : (req.headers && req.headers.host);
  return cookieDomainForHost(h);
}

function buildCookie(name, value, maxAgeSeconds, domain) {
  const secure = process.env.NODE_ENV !== 'development' ? 'Secure; ' : '';
  const dom = domain ? 'Domain=' + domain + '; ' : '';
  return name + '=' + value + '; Path=/; ' + dom + 'HttpOnly; ' + secure + 'SameSite=Strict; Max-Age=' + maxAgeSeconds;
}

function ssoCookieHeader(token, domain) {
  return buildCookie(SSO_COOKIE_NAME, token, SSO_TTL_SECONDS, domain);
}

/* Clearing always emits both the host-only and (when applicable) the
   parent-domain variants so pre-SSO legacy cookies are removed too. */
function clearSsoCookieHeaders(domain) {
  const out = [buildCookie(SSO_COOKIE_NAME, '', 0, null)];
  if (domain) out.push(buildCookie(SSO_COOKIE_NAME, '', 0, domain));
  return out;
}

/* Clear every app's session cookie — the admin "logout everywhere" flow. */
function clearAllAppCookieHeaders(domain) {
  const out = [];
  for (const name of APP_COOKIE_NAMES) {
    out.push(buildCookie(name, '', 0, null));
    if (domain) out.push(buildCookie(name, '', 0, domain));
  }
  return out;
}

module.exports = {
  SSO_COOKIE_NAME, APP_COOKIE_NAMES, SSO_TTL_SECONDS,
  ssoSecret, signSsoSession, verifySsoSession,
  cookieDomainForHost, cookieDomainFromReq,
  ssoCookieHeader, clearSsoCookieHeaders, clearAllAppCookieHeaders,
};
