'use strict';

/* Auth core for the Projects app — identical shape to apps/cars/lib/auth.js,
   scoped to app='projects' so a Projects session is independent of a Cars
   session even though both share the platform_users identity table. */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getDb } = require('./db');

const APP = 'projects';
const COOKIE_NAME = 'af_projects_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;
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
function sessionCookieHeader(token, maxAgeSeconds) {
  const secure = process.env.NODE_ENV !== 'development' ? 'Secure; ' : '';
  return COOKIE_NAME + '=' + token + '; Path=/; HttpOnly; ' + secure + 'SameSite=Strict; Max-Age=' + maxAgeSeconds;
}
function clearCookieHeader() {
  const secure = process.env.NODE_ENV !== 'development' ? 'Secure; ' : '';
  return COOKIE_NAME + '=; Path=/; HttpOnly; ' + secure + 'SameSite=Strict; Max-Age=0';
}

function readSession(req) {
  const cookies = parseCookies(req.headers.get ? req.headers.get('cookie') : req.headers.cookie);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifySession(token);
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
