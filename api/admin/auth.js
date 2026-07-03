'use strict';

/* ═══════════════════════════════════════════════════════════════════
   AL FAROOQUE — Admin Authentication
   POST /api/admin/auth   { action: 'login' | 'verify-otp' | 'resend-otp'
                                   | 'logout' | 'logout-all' | 'change-password' }
   GET  /api/admin/auth            → current session ("me")

   Flow: email + password → OTP emailed → verify OTP → session cookie.
   Admin accounts are completely separate from customer accounts
   (public.admin_users, not auth.users) — customer login can never
   reach this endpoint's data.
   ═══════════════════════════════════════════════════════════════════ */

const bcrypt = require('bcryptjs');
const mailer = require('../_email');
const { getAdminClient } = require('../_supabaseAdmin');
const {
  SESSION_TTL_SECONDS, OTP_TTL_MINUTES, OTP_RESEND_COOLDOWN_SECONDS, OTP_MAX_ATTEMPTS,
  LOGIN_LOCKOUT_MINUTES,
  sha256Hex, generateOtp, generateSessionToken,
  getClientIp, getUserAgent,
  parseCookies, setSessionCookie, clearSessionCookie, SESSION_COOKIE,
  requireCsrfHeader, requireAdminSession,
  isLoginRateLimited, recordLoginAttempt,
  logAudit, readJsonBody,
} = require('../_adminAuth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function otpEmailHtml(code) {
  return '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">' +
    '<h2 style="color:#0891a8;margin:0 0 12px;">AL FAROOQUE Admin — Login Code</h2>' +
    '<p style="color:#333;font-size:14px;line-height:1.6;">Use this code to finish signing in to the admin dashboard. It expires in ' + OTP_TTL_MINUTES + ' minutes and can only be used once.</p>' +
    '<div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f2f2f2;padding:16px 24px;border-radius:8px;text-align:center;margin:20px 0;">' + code + '</div>' +
    '<p style="color:#888;font-size:12px;">If you did not request this, you can safely ignore this email — your account was not accessed.</p>' +
  '</div>';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'same-origin');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  let action = null;
  try {
    /* ── GET: session check ("me") — must work purely off the cookie,
       independent of anything else, so an unauthenticated visitor
       always gets a clean 401 (never a 500). ── */
    if (req.method === 'GET') {
      const admin = await requireAdminSession(req, res);
      if (!admin) return; // response already sent
      return res.status(200).json({ admin: sanitizeAdmin(admin) });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!requireCsrfHeader(req, res)) return;

    const sb = getAdminClient();
    const body = await readJsonBody(req);
    action = body.action;
    const ip = getClientIp(req), ua = getUserAgent(req);

    if (action === 'login') return await handleLogin(req, res, sb, body, ip, ua);
    if (action === 'verify-otp') return await handleVerifyOtp(req, res, sb, body, ip, ua);
    if (action === 'resend-otp') return await handleResendOtp(req, res, sb, body);
    if (action === 'logout') return await handleLogout(req, res, sb);
    if (action === 'logout-all') return await handleLogoutAll(req, res, sb);
    if (action === 'change-password') return await handleChangePassword(req, res, sb, body);
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (err) {
    console.error('[admin/auth]', action, err);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};

function sanitizeAdmin(a) {
  return { id: a.id, email: a.email, full_name: a.full_name, role: a.role, must_change_password: a.must_change_password };
}

/* ── Step 1: email + password ── */
async function handleLogin(req, res, sb, body, ip, ua) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!EMAIL_RE.test(email) || !password) {
    return res.status(400).json({ error: 'Please enter a valid email and password.' });
  }

  if (await isLoginRateLimited(sb, email, ip)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in ' + LOGIN_LOCKOUT_MINUTES + ' minutes.' });
  }

  const { data: admin } = await sb.from('admin_users').select('*').eq('email', email).maybeSingle();
  const genericError = () => res.status(401).json({ error: 'Incorrect email or password.' });

  if (!admin || !admin.is_active) {
    await recordLoginAttempt(sb, email, ip, false);
    return genericError();
  }
  const ok = await bcrypt.compare(password, admin.password_hash);
  await recordLoginAttempt(sb, email, ip, ok);
  if (!ok) return genericError();

  /* Password verified — issue an OTP and email it. */
  const code = generateOtp();
  await sb.from('admin_otp_codes').insert({
    admin_id: admin.id,
    code_hash: sha256Hex(code),
    purpose: 'login',
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
  });

  try {
    await mailer.sendEmail({ to: admin.email, subject: 'Your AL FAROOQUE Admin login code', html: otpEmailHtml(code) });
  } catch (err) {
    console.error('[admin/auth] OTP email failed:', err.message);
    return res.status(500).json({ error: 'Could not send the verification email. Please try again shortly.' });
  }

  await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'admin.login_password_ok', req });
  return res.status(200).json({ step: 'otp', email: admin.email, message: 'A 6-digit code has been sent to your email.' });
}

/* ── Step 2: OTP verification → session ── */
async function handleVerifyOtp(req, res, sb, body, ip, ua) {
  const email = String(body.email || '').trim().toLowerCase();
  const code = String(body.code || '').trim();
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Please enter the 6-digit code.' });
  }

  const { data: admin } = await sb.from('admin_users').select('*').eq('email', email).maybeSingle();
  if (!admin || !admin.is_active) return res.status(401).json({ error: 'Invalid session — please log in again.' });

  const { data: otp } = await sb.from('admin_otp_codes')
    .select('*').eq('admin_id', admin.id).eq('purpose', 'login')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (!otp) return res.status(400).json({ error: 'No active code — please request a new one.' });
  if (otp.consumed_at) return res.status(400).json({ error: 'This code was already used. Please request a new one.' });
  if (new Date(otp.expires_at) < new Date()) return res.status(400).json({ error: 'This code has expired. Please request a new one.' });
  if (otp.attempt_count >= OTP_MAX_ATTEMPTS) return res.status(429).json({ error: 'Too many attempts. Please request a new code.' });

  if (sha256Hex(code) !== otp.code_hash) {
    await sb.from('admin_otp_codes').update({ attempt_count: otp.attempt_count + 1 }).eq('id', otp.id);
    return res.status(401).json({ error: 'Incorrect code. Please try again.' });
  }

  /* Success — consume the OTP, create a session, set the cookie. */
  await sb.from('admin_otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id);

  const token = generateSessionToken();
  await sb.from('admin_sessions').insert({
    admin_id: admin.id,
    token_hash: sha256Hex(token),
    ip, user_agent: ua,
    expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
  });
  await sb.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', admin.id);
  setSessionCookie(res, token, SESSION_TTL_SECONDS);

  await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'admin.login_success', req });
  return res.status(200).json({ ok: true, admin: sanitizeAdmin(admin) });
}

/* ── Resend OTP (60s cooldown) ── */
async function handleResendOtp(req, res, sb, body) {
  const email = String(body.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid request.' });

  const { data: admin } = await sb.from('admin_users').select('*').eq('email', email).maybeSingle();
  if (!admin || !admin.is_active) return res.status(400).json({ error: 'Invalid request.' });

  const { data: last } = await sb.from('admin_otp_codes')
    .select('created_at').eq('admin_id', admin.id).eq('purpose', 'login')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();

  if (last) {
    const elapsed = (Date.now() - new Date(last.created_at).getTime()) / 1000;
    if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
      return res.status(429).json({ error: 'Please wait before requesting another code.', retryAfter: Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed) });
    }
  }

  const code = generateOtp();
  await sb.from('admin_otp_codes').insert({
    admin_id: admin.id, code_hash: sha256Hex(code), purpose: 'login',
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
  });
  try {
    await mailer.sendEmail({ to: admin.email, subject: 'Your AL FAROOQUE Admin login code', html: otpEmailHtml(code) });
  } catch (err) {
    return res.status(500).json({ error: 'Could not send the verification email.' });
  }
  return res.status(200).json({ ok: true, message: 'A new code has been sent.' });
}

/* ── Logout (this device) ── */
async function handleLogout(req, res, sb) {
  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE];
  if (token) await sb.from('admin_sessions').update({ revoked_at: new Date().toISOString() }).eq('token_hash', sha256Hex(token));
  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}

/* ── Logout everywhere (revoke all sessions for this admin) ── */
async function handleLogoutAll(req, res, sb) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  await sb.from('admin_sessions').update({ revoked_at: new Date().toISOString() })
    .eq('admin_id', admin.id).is('revoked_at', null);
  clearSessionCookie(res);
  await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'admin.logout_all_devices', req });
  return res.status(200).json({ ok: true });
}

/* ── Change password (self-service, requires current password) ── */
async function handleChangePassword(req, res, sb, body) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  const current = String(body.current_password || '');
  const next = String(body.new_password || '');
  if (next.length < 8 || !/[A-Za-z]/.test(next) || !/\d/.test(next)) {
    return res.status(400).json({ error: 'New password must be at least 8 characters and include a letter and a number.' });
  }
  const { data: full } = await sb.from('admin_users').select('password_hash').eq('id', admin.id).single();
  const ok = await bcrypt.compare(current, full.password_hash);
  if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });

  const newHash = await bcrypt.hash(next, 12);
  await sb.from('admin_users').update({ password_hash: newHash, must_change_password: false }).eq('id', admin.id);
  await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'admin.password_changed', req });
  return res.status(200).json({ ok: true });
}
