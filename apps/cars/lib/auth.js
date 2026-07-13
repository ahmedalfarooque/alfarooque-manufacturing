'use strict';

/* Auth core for the Cars app: bcrypt password checks, OTP generation/
   hashing, JWT session issuance (httpOnly cookie), and DB-backed rate
   limiting/audit — same hardened shape as the main site's
   api/_adminAuth.js (including the "always check DB write errors,
   never silently continue" lesson learned fixing that system), adapted
   to JWT per this app's own spec instead of an opaque DB-only token. */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getDb } = require('./db');
const { SSO_COOKIE_NAME, verifySsoSession } = require('./sso');

const APP = 'cars';
const COOKIE_NAME = 'af_cars_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours
const OTP_TTL_MINUTES = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MINUTES = 15;

function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not configured.');
  return s;
}

function sha256Hex(input) { return crypto.createHash('sha256').update(String(input)).digest('hex'); }
function generateOtp() { return String(crypto.randomInt(0, 1000000)).padStart(6, '0'); }

function signSession(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, app: APP },
    jwtSecret(),
    { expiresIn: SESSION_TTL_SECONDS }
  );
}
function verifySession(token) {
  try { return jwt.verify(token, jwtSecret()); } catch (_) { return null; }
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}
/* `domain` (optional) scopes the cookie to the parent domain
   (.alfarooque.com) so the admin logout-everywhere flow can clear it
   from any sibling app. Omitted on localhost — behaviour unchanged. */
function sessionCookieHeader(token, maxAgeSeconds, domain) {
  const secure = process.env.NODE_ENV !== 'development' ? 'Secure; ' : '';
  const dom = domain ? 'Domain=' + domain + '; ' : '';
  return COOKIE_NAME + '=' + token + '; Path=/; ' + dom + 'HttpOnly; ' + secure + 'SameSite=Strict; Max-Age=' + maxAgeSeconds;
}
function clearCookieHeader(domain) {
  const secure = process.env.NODE_ENV !== 'development' ? 'Secure; ' : '';
  const dom = domain ? 'Domain=' + domain + '; ' : '';
  return COOKIE_NAME + '=; Path=/; ' + dom + 'HttpOnly; ' + secure + 'SameSite=Strict; Max-Age=0';
}

/* Reads the session from the request's Cookie header and returns the
   decoded JWT payload, or null. Callers (API routes + middleware) are
   responsible for the 401 response — this never touches `res`. */
function readSession(req) {
  const cookies = parseCookies(req.headers.get ? req.headers.get('cookie') : req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  const session = token ? verifySession(token) : null;
  if (session) return session;
  /* SSO fallback — an Admin already signed into a sibling app (QuotePro/
     Projects) is accepted here without a second login. verifySsoSession
     only ever returns admin payloads, so no other role can cross apps
     and permissions are never elevated. */
  if (cookies[SSO_COOKIE_NAME]) return verifySsoSession(cookies[SSO_COOKIE_NAME]);
  return null;
}

async function isLoginRateLimited(email) {
  const sb = getDb();
  const since = new Date(Date.now() - LOGIN_LOCKOUT_MINUTES * 60 * 1000).toISOString();
  const { count } = await sb.from('platform_login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('email', String(email).toLowerCase()).eq('app', APP)
    .eq('success', false).gte('created_at', since);
  return (count || 0) >= LOGIN_MAX_ATTEMPTS;
}
async function recordLoginAttempt(email, ip, success) {
  const sb = getDb();
  await sb.from('platform_login_attempts').insert({ email: String(email).toLowerCase(), app: APP, ip, success });
}

module.exports = {
  APP, COOKIE_NAME, SESSION_TTL_SECONDS, OTP_TTL_MINUTES, OTP_RESEND_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS, LOGIN_LOCKOUT_MINUTES,
  sha256Hex, generateOtp, signSession, verifySession,
  parseCookies, sessionCookieHeader, clearCookieHeader, readSession,
  isLoginRateLimited, recordLoginAttempt,
};
