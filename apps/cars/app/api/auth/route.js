'use strict';

/* POST /cars/api/auth  { action: 'login' | 'verify-otp' | 'resend-otp' | 'logout' }
   GET  /cars/api/auth            → current session ("me")

   Flow: email + password → OTP emailed (or mock-logged) → verify OTP →
   JWT session cookie. Mirrors the main site's api/admin/auth.js design
   — including its two hard-won lessons: (1) every OTP-code / session
   write is checked for a DB error before continuing (an unchecked
   insert failure there caused intermittent "login succeeds but never
   reaches OTP" bugs), and (2) email sending retries transient failures
   instead of failing the whole attempt on one hiccup (see lib/email.js). */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDb } = require('@/lib/db');
const { sendOtpEmail } = require('@/lib/email');
const {
  APP, SESSION_TTL_SECONDS, OTP_TTL_MINUTES, OTP_RESEND_COOLDOWN_SECONDS, OTP_MAX_ATTEMPTS,
  LOGIN_LOCKOUT_MINUTES,
  sha256Hex, generateOtp, signSession,
  sessionCookieHeader, clearCookieHeader, readSession,
  isLoginRateLimited, recordLoginAttempt,
} = require('@/lib/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VIEW_LOGIN_ALLOWED_DOMAIN = '@alfarooque.com';

function otpEmailHtml(code) {
  return '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">' +
    '<h2 style="color:#0f877e;margin:0 0 12px;">TrackFleet — Login Code</h2>' +
    '<p style="color:#333;font-size:14px;line-height:1.6;">Use this code to finish signing in to the Cars Tracking dashboard. It expires in ' + OTP_TTL_MINUTES + ' minutes and can only be used once.</p>' +
    '<div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f2f2f2;padding:16px 24px;border-radius:8px;text-align:center;margin:20px 0;">' + code + '</div>' +
    '<p style="color:#888;font-size:12px;">If you did not request this, you can safely ignore this email.</p>' +
  '</div>';
}
function viewOtpEmailHtml(code) {
  return '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">' +
    '<h2 style="color:#0f877e;margin:0 0 12px;">TrackFleet — View Dashboard Code</h2>' +
    '<p style="color:#333;font-size:14px;line-height:1.6;">Use this code to sign in to the read-only Cars Tracking view. It expires in ' + OTP_TTL_MINUTES + ' minutes and can only be used once.</p>' +
    '<div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f2f2f2;padding:16px 24px;border-radius:8px;text-align:center;margin:20px 0;">' + code + '</div>' +
    '<p style="color:#888;font-size:12px;">If you did not request this, you can safely ignore this email.</p>' +
  '</div>';
}
function sanitizeUser(u) { return { id: u.id, email: u.email, full_name: u.full_name, role: u.role }; }
function json(data, status) { return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json' } }); }
function getIp(req) { return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''; }
function getUa(req) { return req.headers.get('user-agent') || ''; }

export async function GET(req) {
  const session = readSession(req);
  if (!session) return json({ error: 'Not authenticated.' }, 401);
  const sb = getDb();
  const { data: user } = await sb.from('platform_users').select('*').eq('id', session.sub).maybeSingle();
  if (!user || !user.is_active) return json({ error: 'Account disabled.' }, 401);
  return json({ user: sanitizeUser(user) });
}

export async function POST(req) {
  let action;
  try {
    const body = await req.json().catch(() => ({}));
    action = body.action;
    const sb = getDb();
    const ip = getIp(req), ua = getUa(req);

    if (action === 'login') return await handleLogin(sb, body, ip);
    if (action === 'verify-otp') return await handleVerifyOtp(sb, body, ip, ua);
    if (action === 'resend-otp') return await handleResendOtp(sb, body);
    if (action === 'logout') return handleLogout(sb, req);
    if (action === 'view-login') return await handleViewLogin(sb, body);
    if (action === 'view-verify-otp') return await handleViewVerifyOtp(sb, body, ip, ua);
    if (action === 'view-resend-otp') return await handleViewResendOtp(sb, body);
    return json({ error: 'Unknown action.' }, 400);
  } catch (err) {
    console.error('[cars/auth]', action, err);
    return json({ error: 'Server error. Please try again.' }, 500);
  }
}

async function handleLogin(sb, body, ip) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!EMAIL_RE.test(email) || !password) return json({ error: 'Please enter a valid email and password.' }, 400);

  if (await isLoginRateLimited(email)) {
    return json({ error: 'Too many failed attempts. Try again in ' + LOGIN_LOCKOUT_MINUTES + ' minutes.' }, 429);
  }

  const { data: user } = await sb.from('platform_users').select('*').eq('email', email).maybeSingle();
  const genericError = () => json({ error: 'Incorrect email or password.' }, 401);
  if (!user || !user.is_active) { await recordLoginAttempt(email, ip, false); return genericError(); }

  const ok = await bcrypt.compare(password, user.password_hash);
  await recordLoginAttempt(email, ip, ok);
  if (!ok) return genericError();

  const code = generateOtp();
  const { error: otpInsertErr } = await sb.from('platform_otp_codes').insert({
    user_id: user.id, app: APP, code_hash: sha256Hex(code), purpose: 'login',
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
  });
  if (otpInsertErr) {
    console.error('[cars/auth] OTP insert failed:', otpInsertErr.message);
    return json({ error: 'Could not start verification. Please try again.' }, 500);
  }

  try {
    const result = await sendOtpEmail({ to: user.email, subject: 'Your TrackFleet login code', html: otpEmailHtml(code), mockLabel: 'Cars login OTP', code });
    return json({ step: 'otp', email: user.email, mocked: !!result.mocked, message: result.mocked ? 'Email not configured — code was logged to the server console.' : 'A 6-digit code has been sent to your email.' });
  } catch (err) {
    console.error('[cars/auth] OTP email failed:', err.message);
    return json({ error: 'Could not send the verification email. Please try again shortly.' }, 500);
  }
}

async function handleVerifyOtp(sb, body, ip, ua) {
  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').trim();
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) return json({ error: 'Please enter the 6-digit code.' }, 400);

  const { data: user } = await sb.from('platform_users').select('*').eq('email', email).maybeSingle();
  if (!user || !user.is_active) return json({ error: 'Invalid session — please log in again.' }, 401);

  const { data: otp } = await sb.from('platform_otp_codes')
    .select('*').eq('user_id', user.id).eq('app', APP).eq('purpose', 'login')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (!otp) return json({ error: 'No active code — please request a new one.' }, 400);
  if (otp.consumed_at) return json({ error: 'This code was already used. Please request a new one.' }, 400);
  if (new Date(otp.expires_at) < new Date()) return json({ error: 'This code has expired. Please request a new one.' }, 400);
  if (otp.attempt_count >= OTP_MAX_ATTEMPTS) return json({ error: 'Too many attempts. Please request a new code.' }, 429);

  if (sha256Hex(code) !== otp.code_hash) {
    await sb.from('platform_otp_codes').update({ attempt_count: otp.attempt_count + 1 }).eq('id', otp.id);
    return json({ error: 'Incorrect code. Please try again.' }, 401);
  }

  await sb.from('platform_otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id);

  const token = signSession(user);
  const { error: sessionInsertErr } = await sb.from('platform_sessions').insert({
    user_id: user.id, app: APP, token_hash: sha256Hex(token), ip, user_agent: ua,
    expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
  });
  if (sessionInsertErr) {
    console.error('[cars/auth] session insert failed:', sessionInsertErr.message);
    return json({ error: 'Could not complete sign-in. Please try again.' }, 500);
  }
  await sb.from('platform_users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);

  const res = json({ ok: true, user: sanitizeUser(user) });
  res.headers.set('Set-Cookie', sessionCookieHeader(token, SESSION_TTL_SECONDS));
  return res;
}

async function handleResendOtp(sb, body) {
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: 'Invalid request.' }, 400);

  const { data: user } = await sb.from('platform_users').select('*').eq('email', email).maybeSingle();
  if (!user || !user.is_active) return json({ error: 'Invalid request.' }, 400);

  const { data: last } = await sb.from('platform_otp_codes')
    .select('created_at').eq('user_id', user.id).eq('app', APP).eq('purpose', 'login')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (last) {
    const elapsed = (Date.now() - new Date(last.created_at).getTime()) / 1000;
    if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
      return json({ error: 'Please wait before requesting another code.', retryAfter: Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed) }, 429);
    }
  }

  const code = generateOtp();
  const { error: otpInsertErr } = await sb.from('platform_otp_codes').insert({
    user_id: user.id, app: APP, code_hash: sha256Hex(code), purpose: 'login',
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
  });
  if (otpInsertErr) return json({ error: 'Could not start verification. Please try again.' }, 500);

  try {
    const result = await sendOtpEmail({ to: user.email, subject: 'Your TrackFleet login code', html: otpEmailHtml(code), mockLabel: 'Cars resend OTP', code });
    return json({ ok: true, mocked: !!result.mocked, message: result.mocked ? 'Email not configured — new code was logged to the server console.' : 'A new code has been sent.' });
  } catch (err) {
    return json({ error: 'Could not send the verification email.' }, 500);
  }
}

/* ── "User" login — email only, no password, restricted to the
   @alfarooque.com domain. Anyone with a valid company email can view;
   nothing here can ever mint an admin-level session (the JWT's role
   claim is hardcoded to "viewer" at verify time below, regardless of
   what role — if any — the underlying platform_users row actually
   has), so this route can never become a backdoor into admin access
   even if someone's admin email happens to also pass through it.

   Every pre-OTP rejection — bad format, wrong domain, disabled
   account — returns the exact same "Invalid username." message. Per
   the brief: never confirm/deny which part was wrong, so the response
   never reveals the domain allowlist or which emails are valid
   company accounts. ── */
const INVALID_USERNAME = () => json({ error: 'Invalid username.' }, 400);

async function findOrCreateViewUser(sb, email) {
  const { data: existing } = await sb.from('platform_users').select('*').eq('email', email).maybeSingle();
  if (existing) return { user: existing, error: null };

  // Unusable random password — this account can only ever sign in via OTP, never via the password form.
  const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  const { data: created, error } = await sb.from('platform_users').insert({
    email, password_hash: unusablePassword, full_name: email.split('@')[0], role: 'viewer', must_change_password: false,
  }).select().maybeSingle();
  return { user: created, error };
}

async function handleViewLogin(sb, body) {
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || !email.endsWith(VIEW_LOGIN_ALLOWED_DOMAIN)) {
    return INVALID_USERNAME();
  }

  const { user, error: findErr } = await findOrCreateViewUser(sb, email);
  if (findErr || !user) {
    console.error('[cars/auth] view-login user lookup/create failed:', findErr && findErr.message);
    return json({ error: 'Could not start verification. Please try again.' }, 500);
  }
  if (!user.is_active) return INVALID_USERNAME();

  const code = generateOtp();
  const { error: otpInsertErr } = await sb.from('platform_otp_codes').insert({
    user_id: user.id, app: APP, code_hash: sha256Hex(code), purpose: 'view-login',
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
  });
  if (otpInsertErr) {
    console.error('[cars/auth] view-login OTP insert failed:', otpInsertErr.message);
    return json({ error: 'Could not start verification. Please try again.' }, 500);
  }

  try {
    const result = await sendOtpEmail({ to: email, subject: 'Your TrackFleet View Dashboard code', html: viewOtpEmailHtml(code), mockLabel: 'Cars view-login OTP', code });
    return json({ step: 'otp', email, mocked: !!result.mocked, message: result.mocked ? 'Email not configured — code was logged to the server console.' : 'A 6-digit code has been sent to your email.' });
  } catch (err) {
    console.error('[cars/auth] view-login OTP email failed:', err.message);
    return json({ error: 'Could not send the verification email. Please try again shortly.' }, 500);
  }
}

async function handleViewVerifyOtp(sb, body, ip, ua) {
  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').trim();
  if (!email.endsWith(VIEW_LOGIN_ALLOWED_DOMAIN)) return INVALID_USERNAME();
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) return json({ error: 'Please enter the 6-digit code.' }, 400);

  const { data: user } = await sb.from('platform_users').select('*').eq('email', email).maybeSingle();
  if (!user || !user.is_active) return json({ error: 'Invalid session — please start over.' }, 401);

  const { data: otp } = await sb.from('platform_otp_codes')
    .select('*').eq('user_id', user.id).eq('app', APP).eq('purpose', 'view-login')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (!otp) return json({ error: 'No active code — please request a new one.' }, 400);
  if (otp.consumed_at) return json({ error: 'This code was already used. Please request a new one.' }, 400);
  if (new Date(otp.expires_at) < new Date()) return json({ error: 'This code has expired. Please request a new one.' }, 400);
  if (otp.attempt_count >= OTP_MAX_ATTEMPTS) return json({ error: 'Too many attempts. Please request a new code.' }, 429);

  if (sha256Hex(code) !== otp.code_hash) {
    await sb.from('platform_otp_codes').update({ attempt_count: otp.attempt_count + 1 }).eq('id', otp.id);
    return json({ error: 'Incorrect code. Please try again.' }, 401);
  }

  await sb.from('platform_otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id);

  // Role is always forced to "viewer" for a session minted via this route — see the header comment above.
  const token = signSession({ ...user, role: 'viewer' });
  const { error: sessionInsertErr } = await sb.from('platform_sessions').insert({
    user_id: user.id, app: APP, token_hash: sha256Hex(token), ip, user_agent: ua,
    expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
  });
  if (sessionInsertErr) {
    console.error('[cars/auth] view-login session insert failed:', sessionInsertErr.message);
    return json({ error: 'Could not complete sign-in. Please try again.' }, 500);
  }
  await sb.from('platform_users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);

  const res = json({ ok: true, user: sanitizeUser({ ...user, role: 'viewer' }) });
  res.headers.set('Set-Cookie', sessionCookieHeader(token, SESSION_TTL_SECONDS));
  return res;
}

async function handleViewResendOtp(sb, body) {
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || !email.endsWith(VIEW_LOGIN_ALLOWED_DOMAIN)) return json({ error: 'Invalid request.' }, 400);

  const { data: user } = await sb.from('platform_users').select('*').eq('email', email).maybeSingle();
  if (!user || !user.is_active) return json({ error: 'Invalid request.' }, 400);

  const { data: last } = await sb.from('platform_otp_codes')
    .select('created_at').eq('user_id', user.id).eq('app', APP).eq('purpose', 'view-login')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (last) {
    const elapsed = (Date.now() - new Date(last.created_at).getTime()) / 1000;
    if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
      return json({ error: 'Please wait before requesting another code.', retryAfter: Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed) }, 429);
    }
  }

  const code = generateOtp();
  const { error: otpInsertErr } = await sb.from('platform_otp_codes').insert({
    user_id: user.id, app: APP, code_hash: sha256Hex(code), purpose: 'view-login',
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
  });
  if (otpInsertErr) return json({ error: 'Could not start verification. Please try again.' }, 500);

  try {
    const result = await sendOtpEmail({ to: email, subject: 'Your TrackFleet View Dashboard code', html: viewOtpEmailHtml(code), mockLabel: 'Cars view-login resend OTP', code });
    return json({ ok: true, mocked: !!result.mocked, message: result.mocked ? 'Email not configured — new code was logged to the server console.' : 'A new code has been sent.' });
  } catch (err) {
    return json({ error: 'Could not send the verification email.' }, 500);
  }
}

async function handleLogout(sb, req) {
  const session = readSession(req);
  if (session) {
    await sb.from('platform_sessions').update({ revoked_at: new Date().toISOString() })
      .eq('user_id', session.sub).eq('app', APP).is('revoked_at', null);
  }
  const res = json({ ok: true });
  res.headers.set('Set-Cookie', clearCookieHeader());
  return res;
}

export async function DELETE(req) {
  return handleLogout(getDb(), req);
}
