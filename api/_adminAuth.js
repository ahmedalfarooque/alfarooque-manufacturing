'use strict';

/* ═══════════════════════════════════════════════════════════════════
   Shared admin-auth helpers: sessions, OTP, rate limiting, audit log,
   cookies, CSRF. Used by every /api/admin/* handler. Import-only
   (leading underscore ⇒ not routed by Vercel).
   ═══════════════════════════════════════════════════════════════════ */

const crypto = require('crypto');
const { getAdminClient } = require('./_supabaseAdmin');

const SESSION_COOKIE = 'af_admin_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours
const OTP_TTL_MINUTES = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_MAX_ATTEMPTS = 5;
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MINUTES = 15;

/* ── Hashing / token helpers ── */
function sha256Hex(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex');
}
function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

/* ── Request metadata ── */
function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || '';
}
function getUserAgent(req) {
  return req.headers['user-agent'] || '';
}

/* ── Cookies (HttpOnly, Secure, SameSite=Strict — never readable by JS) ── */
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}
/* Scoped to /api/admin — that's the only path these ever need to reach.
   (NOT /admin — the pages live at /pages/admin/* and the API at
   /api/admin/*, so a cookie Path of "/admin" would never actually match
   either and the browser would silently drop it on every request.) */
function setSessionCookie(res, token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV !== 'development' ? 'Secure; ' : '';
  const cookie = SESSION_COOKIE + '=' + token +
    '; Path=/api/admin; HttpOnly; ' + secure + 'SameSite=Strict; Max-Age=' + maxAgeSeconds;
  res.setHeader('Set-Cookie', cookie);
}
function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV !== 'development' ? 'Secure; ' : '';
  res.setHeader('Set-Cookie', SESSION_COOKIE + '=; Path=/api/admin; HttpOnly; ' + secure + 'SameSite=Strict; Max-Age=0');
}

/* ── CSRF: SameSite=Strict cookies already stop cross-site requests from
   carrying the session cookie. As defense in depth we also require a
   custom header on every state-changing call — a cross-origin page
   cannot attach custom headers to a request without triggering a CORS
   preflight, which our API never approves for foreign origins. ── */
function requireCsrfHeader(req, res) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
  if (req.headers['x-admin-request'] !== '1') {
    res.status(403).json({ error: 'Missing CSRF header.' });
    return false;
  }
  return true;
}

/* ── Session verification — call at the top of every protected handler ──
   Returns the admin_users row on success, or null (and already sent the
   403/401 response) on failure. ── */
async function requireAdminSession(req, res) {
  if (!requireCsrfHeader(req, res)) return null;
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (!token) { res.status(401).json({ error: 'Not authenticated.' }); return null; }

  const sb = getAdminClient();
  const tokenHash = sha256Hex(token);
  /* Embedded join (via the admin_sessions.admin_id FK) fetches the
     session AND its admin_users row in a single round-trip instead of
     two sequential ones — every protected admin request was paying for
     this twice before. */
  const { data: session } = await sb.from('admin_sessions')
    .select('id, expires_at, revoked_at, admin:admin_users(id, email, full_name, role, is_active, must_change_password)')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!session || session.revoked_at || new Date(session.expires_at) < new Date()) {
    res.status(401).json({ error: 'Session expired or invalid.' });
    return null;
  }

  const admin = session.admin;
  if (!admin || !admin.is_active) {
    res.status(401).json({ error: 'Account disabled.' });
    return null;
  }
  admin.session_id = session.id;
  return admin;
}

/* ── Rate limiting (server-side, DB-backed — survives serverless cold starts) ── */
async function isLoginRateLimited(sb, email, ip) {
  const since = new Date(Date.now() - LOGIN_LOCKOUT_MINUTES * 60 * 1000).toISOString();
  const { count } = await sb.from('admin_login_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('email', String(email).toLowerCase())
    .eq('success', false)
    .gte('created_at', since);
  return (count || 0) >= LOGIN_MAX_ATTEMPTS;
}
async function recordLoginAttempt(sb, email, ip, success) {
  await sb.from('admin_login_attempts').insert({ email: String(email).toLowerCase(), ip, success });
}

/* ── Audit log ── */
async function logAudit(sb, { adminId, adminEmail, action, entityType, entityId, details, req }) {
  try {
    await sb.from('audit_logs').insert({
      admin_id: adminId || null,
      admin_email: adminEmail || null,
      action,
      entity_type: entityType || null,
      entity_id: entityId != null ? String(entityId) : null,
      details: details || null,
      ip: req ? getClientIp(req) : null,
      user_agent: req ? getUserAgent(req) : null,
    });
  } catch (_) { /* auditing must never break the primary action */ }
}

/* ── JSON body parsing (mirrors api/quote.js's guard for raw streams) ── */
async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const raw = await new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => (s += c));
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });
  try { return raw ? JSON.parse(raw) : {}; } catch (_) { return {}; }
}

module.exports = {
  SESSION_COOKIE, SESSION_TTL_SECONDS, OTP_TTL_MINUTES, OTP_RESEND_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS, LOGIN_MAX_ATTEMPTS, LOGIN_LOCKOUT_MINUTES,
  sha256Hex, generateOtp, generateSessionToken,
  getClientIp, getUserAgent,
  parseCookies, setSessionCookie, clearSessionCookie,
  requireCsrfHeader, requireAdminSession,
  isLoginRateLimited, recordLoginAttempt,
  logAudit, readJsonBody,
};
