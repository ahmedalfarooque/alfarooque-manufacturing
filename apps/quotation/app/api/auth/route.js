'use strict';

/* POST /api/auth  { action: 'login' | 'verify-otp' | 'resend-otp' | 'logout' }
   GET  /api/auth            → current session ("me")
   Identical design to apps/cars/app/api/auth/route.js — see that file's
   header comment for the two hardened lessons this shares (checked DB
   writes, retrying email sends). */

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
    '<h2 style="color:#0f877e;margin:0 0 12px;">QuotePro — Login Code</h2>' +
    '<p style="color:#333;font-size:14px;line-height:1.6;">Use this code to finish signing in to the Project Management dashboard. It expires in ' + OTP_TTL_MINUTES + ' minutes and can only be used once.</p>' +
    '<div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f2f2f2;padding:16px 24px;border-radius:8px;text-align:center;margin:20px 0;">' + code + '</div>' +
    '<p style="color:#888;font-size:12px;">If you did not request this, you can safely ignore this email.</p>' +
  '</div>';
}
function viewOtpEmailHtml(code) {
  return '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">' +
    '<h2 style="color:#0f877e;margin:0 0 12px;">QuotePro — View Dashboard Code</h2>' +
    '<p style="color:#333;font-size:14px;line-height:1.6;">Use this code to sign in to the read-only Quotation view. It expires in ' + OTP_TTL_MINUTES + ' minutes and can only be used once.</p>' +
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
    console.error('[quotation/auth]', action, err);
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
    console.error('[quotation/auth] OTP insert failed:', otpInsertErr.message);
    return json({ error: 'Could not start verification. Please try again.' }, 500);
  }

  try {
    const result = await sendOtpEmail({ to: user.email, subject: 'Your QuotePro login code', html: otpEmailHtml(code), mockLabel: 'Quotation login OTP', code });
    return json({ step: 'otp', email: user.email, mocked: !!result.mocked, message: result.mocked ? 'Email not configured — code was logged to the server console.' : 'A 6-digit code has been sent to your email.' });
  } catch (err) {
    console.error('[quotation/auth] OTP email failed:', err.message);
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
    console.error('[quotation/auth] session insert failed:', sessionInsertErr.message);
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
    const result = await sendOtpEmail({ to: user.email, subject: 'Your QuotePro login code', html: otpEmailHtml(code), mockLabel: 'Projects resend OTP', code });
    return json({ ok: true, mocked: !!result.mocked, message: result.mocked ? 'Email not configured — new code was logged to the server console.' : 'A new code has been sent.' });
  } catch (err) {
    return json({ error: 'Could not send the verification email.' }, 500);
  }
}

/* ── View Dashboard login — email only, no password. Three tiers now
   share this one OTP flow, distinguished purely by the platform_users
   row's existing `role`:
     - 'admin'    — an admin CAN also sign in this way (OTP instead of
                    password); still never grants MORE than their real
                    DB role, so this stays safe either way.
     - 'viewer'   — "Internal Company User": auto-created on first
                    login for any @alfarooque.com email, sees
                    everything (unchanged behavior from before).
     - 'external' — "External Assigned User": NEVER auto-created here.
                    An admin must pre-create the row (Users page) with
                    role='external' before that person can log in —
                    matches the spec's "admin creates name/email/
                    phone/position only, no password" requirement.
   So: look up the user FIRST. If found, log them in via OTP using
   their real role, regardless of email domain (this is what lets an
   External user with a gmail/hotmail/etc. address in — their row
   already exists with role='external'). Only when the email is NOT
   found do we fall back to the old domain-gated auto-create, and only
   for @alfarooque.com (unknown external emails are rejected — they
   must be created by an admin first). ── */
async function findOrCreateViewUser(sb, email) {
  const { data: existing } = await sb.from('platform_users').select('*').eq('email', email).maybeSingle();
  if (existing) return { user: existing, error: null, isNew: false };

  if (!email.endsWith(VIEW_LOGIN_ALLOWED_DOMAIN)) return { user: null, error: null, isNew: false };

  // Unusable random password — this account can only ever sign in via OTP, never via the password form.
  const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
  const { data: created, error } = await sb.from('platform_users').insert({
    email, password_hash: unusablePassword, full_name: email.split('@')[0], role: 'viewer', must_change_password: false,
  }).select().maybeSingle();
  return { user: created, error, isNew: true };
}

/* Every pre-OTP rejection in this flow — bad format, wrong domain,
   disabled account — returns the exact same "Invalid username."
   message. Per the brief: never confirm/deny which part was wrong
   (not "wrong domain", not "OTP failed", not "account disabled") —
   a uniform response is the only way this doesn't leak which emails
   are valid company accounts. */
const INVALID_USERNAME = () => json({ error: 'Invalid username.' }, 400);

async function handleViewLogin(sb, body) {
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return INVALID_USERNAME();

  const { user, error: findErr } = await findOrCreateViewUser(sb, email);
  if (findErr) {
    console.error('[quotation/auth] view-login user lookup/create failed:', findErr.message);
    return json({ error: 'Could not start verification. Please try again.' }, 500);
  }
  // Unknown email + not an @alfarooque.com address → reject (external
  // users must be pre-created by an admin before they can log in).
  if (!user) return INVALID_USERNAME();
  if (!user.is_active || user.status === 'Blocked' || user.status === 'Inactive') return INVALID_USERNAME();
  if (user.otp_login_enabled === false) return INVALID_USERNAME();

  const code = generateOtp();
  const { error: otpInsertErr } = await sb.from('platform_otp_codes').insert({
    user_id: user.id, app: APP, code_hash: sha256Hex(code), purpose: 'view-login',
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
  });
  if (otpInsertErr) {
    console.error('[quotation/auth] view-login OTP insert failed:', otpInsertErr.message);
    return json({ error: 'Could not start verification. Please try again.' }, 500);
  }

  try {
    const result = await sendOtpEmail({ to: email, subject: 'Your QuotePro View Dashboard code', html: viewOtpEmailHtml(code), mockLabel: 'Quotation view-login OTP', code });
    return json({ step: 'otp', email, mocked: !!result.mocked, message: result.mocked ? 'Email not configured — code was logged to the server console.' : 'A 6-digit code has been sent to your email.' });
  } catch (err) {
    console.error('[quotation/auth] view-login OTP email failed:', err.message);
    return json({ error: 'Could not send the verification email. Please try again shortly.' }, 500);
  }
}

async function handleViewVerifyOtp(sb, body, ip, ua) {
  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').trim();
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

  // Role reflects whatever is actually on the platform_users row —
  // admin/viewer/external. No longer forced to "viewer": an admin or
  // external user logging in via this OTP-only path keeps their real
  // permissions (an admin never gets LESS than they should; an
  // external user never gets MORE, since they're never auto-created
  // with anything but 'external' or 'viewer' — see findOrCreateViewUser).
  const token = signSession(user);
  const { error: sessionInsertErr } = await sb.from('platform_sessions').insert({
    user_id: user.id, app: APP, token_hash: sha256Hex(token), ip, user_agent: ua,
    expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
  });
  if (sessionInsertErr) {
    console.error('[quotation/auth] view-login session insert failed:', sessionInsertErr.message);
    return json({ error: 'Could not complete sign-in. Please try again.' }, 500);
  }
  await sb.from('platform_users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);

  const res = json({ ok: true, user: sanitizeUser(user) });
  res.headers.set('Set-Cookie', sessionCookieHeader(token, SESSION_TTL_SECONDS));
  return res;
}

async function handleViewResendOtp(sb, body) {
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json({ error: 'Invalid request.' }, 400);

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
    const result = await sendOtpEmail({ to: email, subject: 'Your QuotePro View Dashboard code', html: viewOtpEmailHtml(code), mockLabel: 'Quotation view-login resend OTP', code });
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
