'use strict';

const { getDb } = require('@/lib/db');
const { json } = require('@/lib/http');
const { sendOtpEmail } = require('@/lib/email');
const bcrypt = require('bcryptjs');
const {
  APP, COOKIE_NAME, SESSION_TTL_SECONDS, OTP_TTL_MINUTES, OTP_RESEND_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS, sha256Hex, generateOtp, signSession, readSession,
  sessionCookieHeader, clearCookieHeader, isLoginRateLimited, recordLoginAttempt,
} = require('@/lib/auth');
const { SSO_COOKIE_NAME, signSsoSession, ssoCookieHeader, clearSsoCookieHeader } = require('@/lib/sso');
const { isSuperAdminEmail } = require('@/lib/superAdmin');

function otpEmailHtml(code) {
  return '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">' +
    '<h2 style="color:#06B6D4;margin:0 0 12px;">CRM — Login Code</h2>' +
    '<p style="color:#333;font-size:14px;line-height:1.6;">Use this code to finish signing in to the AL FAROOQUE CRM dashboard. It expires in ' + OTP_TTL_MINUTES + ' minutes and can only be used once.</p>' +
    '<div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f2f2f2;padding:16px 24px;border-radius:8px;text-align:center;margin:20px 0;">' + code + '</div>' +
    '<p style="color:#888;font-size:12px;">If you did not request this, you can safely ignore this email.</p></div>';
}

export async function GET(req) {
  const session = readSession(req);
  if (!session) return json({ error: 'Not authenticated.' }, 401);
  return json({ user: session });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { action } = body;
  const sb = getDb();

  if (action === 'email-login') {
    const email = String(body.email || '').trim().toLowerCase();
    const { data: user } = await sb.from('platform_users').select('id, email, is_active, otp_login_enabled').eq('email', email).maybeSingle();
    if (!user || !user.is_active || user.otp_login_enabled === false) return json({ error: 'Invalid username.' }, 400);
    const otp = generateOtp();
    const { error } = await sb.from('platform_otp_codes').insert({
      user_id: user.id, app: APP, purpose: 'login', code_hash: sha256Hex(otp),
      expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString(),
    });
    if (error) return json({ error: 'Could not start verification. Please try again.' }, 500);
    try {
      const result = await sendOtpEmail({ to: email, subject: 'Your CRM login code', html: otpEmailHtml(otp), mockLabel: 'CRM email OTP', code: otp });
      return json({ step: 'otp', email, mocked: !!result.mocked, message: result.mocked ? 'Email not configured — code was logged to the server console.' : 'A 6-digit code has been sent to your email.' });
    } catch (error) { return json({ error: 'Could not send the verification email. Please try again shortly.' }, 500); }
  }

  if (action === 'login') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) return json({ error: 'Email and password are required.' }, 400);

    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    if (await isLoginRateLimited(email)) return json({ error: 'Too many failed attempts. Try again later.' }, 429);

    const { data: user } = await sb.from('platform_users').select('id, email, password_hash, role, is_active, full_name').eq('email', email).maybeSingle();
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash || ''))) {
      await recordLoginAttempt(email, ip, false);
      return json({ error: 'Invalid email or password.' }, 401);
    }

    let role = user.role === 'admin' ? 'admin' : 'viewer';
    if (isSuperAdminEmail(email)) role = 'admin';
    else {
      const { data: appRole } = await sb.from('crm_user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (appRole) role = appRole.role;
    }

    await recordLoginAttempt(email, ip, true);
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
    const { error: otpInsertError } = await sb.from('platform_otp_codes').insert({
      user_id: user.id, app: APP, purpose: 'login', code_hash: sha256Hex(otp), expires_at: expiresAt,
    });
    if (otpInsertError) return json({ error: 'Could not start verification. Please try again.' }, 500);
    try {
      const result = await sendOtpEmail({ to: email, subject: 'Your CRM login code', html: otpEmailHtml(otp), mockLabel: 'CRM login OTP', code: otp });
      return json({ step: 'otp', email, mocked: !!result.mocked, message: result.mocked ? 'Email not configured — code was logged to the server console.' : `OTP sent to ${email}` });
    } catch (error) {
      console.error('[crm/auth] OTP email failed:', error.message);
      return json({ error: 'Could not send the verification email. Please try again shortly.' }, 500);
    }
  }

  if (action === 'verify-otp') {
    const email = String(body.email || '').trim().toLowerCase();
    const otp = String(body.code || body.otp || '').trim();
    if (!email || !otp) return json({ error: 'Email and OTP are required.' }, 400);

    const { data: user } = await sb.from('platform_users').select('id, email, role').eq('email', email).maybeSingle();
    if (!user) return json({ error: 'No pending verification. Please login again.' }, 400);

    const { data: record } = await sb.from('platform_otp_codes')
      .select('*').eq('user_id', user.id).eq('app', APP).eq('purpose', 'login')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!record) return json({ error: 'No OTP found. Please login again.' }, 400);
    if (record.consumed_at) return json({ error: 'This code was already used. Please login again.' }, 400);
    if (new Date(record.expires_at) < new Date()) return json({ error: 'OTP has expired.' }, 400);
    if ((record.attempt_count || 0) >= OTP_MAX_ATTEMPTS) return json({ error: 'Too many OTP attempts.' }, 400);

    if (record.code_hash !== sha256Hex(otp)) {
      await sb.from('platform_otp_codes').update({ attempt_count: (record.attempt_count || 0) + 1 }).eq('id', record.id);
      return json({ error: 'Invalid OTP.' }, 401);
    }

    await sb.from('platform_otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', record.id);

    let role = user.role === 'admin' ? 'admin' : 'viewer';
    if (isSuperAdminEmail(email)) role = 'admin';
    else {
      const { data: appRole } = await sb.from('crm_user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (appRole) role = appRole.role;
    }

    const sessionUser = { id: user.id, email: user.email, role };
    const token = signSession(sessionUser);
    const ip = req.headers.get('x-forwarded-for') || '';
    const { error: sessionError } = await sb.from('platform_sessions').insert({
      user_id: user.id, app: APP, token_hash: sha256Hex(token), ip,
      user_agent: req.headers.get('user-agent') || '',
      expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
    });
    if (sessionError) return json({ error: 'Could not complete sign-in. Please try again.' }, 500);
    const ssoToken = signSsoSession(sessionUser);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', sessionCookieHeader(token, SESSION_TTL_SECONDS));
    headers.append('Set-Cookie', ssoCookieHeader(ssoToken, SESSION_TTL_SECONDS));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  if (action === 'resend-otp') {
    const email = String(body.email || '').trim().toLowerCase();
    const { data: user } = await sb.from('platform_users').select('id, email').eq('email', email).maybeSingle();
    if (!user) return json({ error: 'Invalid request.' }, 400);

    const { data: record } = await sb.from('platform_otp_codes')
      .select('created_at').eq('user_id', user.id).eq('app', APP).eq('purpose', 'login')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (record) {
      const secondsSince = (Date.now() - new Date(record.created_at).getTime()) / 1000;
      if (secondsSince < OTP_RESEND_COOLDOWN_SECONDS) return json({ error: `Please wait ${Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSince)}s before resending.` }, 429);
    }
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
    const { error: otpInsertError } = await sb.from('platform_otp_codes').insert({
      user_id: user.id, app: APP, purpose: 'login', code_hash: sha256Hex(otp), expires_at: expiresAt,
    });
    if (otpInsertError) return json({ error: 'Could not start verification. Please try again.' }, 500);
    try {
      const result = await sendOtpEmail({ to: email, subject: 'Your CRM login code', html: otpEmailHtml(otp), mockLabel: 'CRM resend OTP', code: otp });
      return json({ ok: true, mocked: !!result.mocked, message: result.mocked ? 'Email not configured — code was logged to the server console.' : 'A new code has been sent.' });
    } catch (error) {
      return json({ error: 'Could not send the verification email.' }, 500);
    }
  }

  if (action === 'logout') {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', clearCookieHeader());
    headers.append('Set-Cookie', clearSsoCookieHeader());
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  return json({ error: 'Invalid action.' }, 400);
}
