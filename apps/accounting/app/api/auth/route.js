'use strict';

const bcrypt = require('bcryptjs');
const { getDb } = require('@/lib/db');
const { json } = require('@/lib/http');
const { sendOtpEmail } = require('@/lib/email');
const {
  APP, COOKIE_NAME, SESSION_TTL_SECONDS,
  sha256Hex, generateOtp, signSession, readSession,
  parseCookies, sessionCookieHeader, clearCookieHeader,
  isLoginRateLimited, recordLoginAttempt,
} = require('@/lib/auth');
const { signSsoSession, ssoCookieHeader, clearSsoCookieHeaders, clearAllAppCookieHeaders, cookieDomainFromReq } = require('@/lib/sso');
const { isSuperAdminEmail } = require('@/lib/superAdmin');
const { loginDecision, sessionRoleFor } = require('../../../../shared/appAccess');

function otpEmailHtml(code) {
  return '<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">' +
    '<h2 style="color:#06B6D4;margin:0 0 12px;">Accounting — Login Code</h2>' +
    '<p style="color:#333;font-size:14px;line-height:1.6;">Use this code to finish signing in to the AL FAROOQUE Accounting dashboard. It expires in 5 minutes and can only be used once.</p>' +
    '<div style="font-size:32px;font-weight:700;letter-spacing:8px;background:#f2f2f2;padding:16px 24px;border-radius:8px;text-align:center;margin:20px 0;">' + code + '</div>' +
    '<p style="color:#888;font-size:12px;">If you did not request this, you can safely ignore this email.</p></div>';
}

/* Application access denied at sign-in: no session is minted. The reply
   names the applications the account does have so the login page can
   point the user there. */
function accessDenied(decision) {
  const noApps = decision.reason === 'no_apps';
  return json({
    error: noApps ? 'No applications have been assigned to your account. Please contact your administrator.' : 'Your account does not have access to this application.',
    code: noApps ? 'NO_APPS' : 'APP_NOT_GRANTED', apps: decision.apps,
  }, 403);
}

export async function GET(req) {
  const session = readSession(req);
  if (!session) return json({ error: 'Not authenticated.' }, 401);
  return json({ user: { id: session.sub, email: session.email, role: session.role, app: session.app || APP } });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { action } = body;
  const domain = cookieDomainFromReq(req);
  const ip = req.headers.get('x-forwarded-for') || '';
  const sb = getDb();

  if (action === 'email-login') {
    const email = String(body.email || '').toLowerCase().trim();
    const { data: user, error: lookupError } = await sb.from('platform_users').select('id, email, is_active, otp_login_enabled').eq('email', email).maybeSingle();
    if (lookupError) console.error('[accounting/auth] platform_users lookup failed:', lookupError.message, lookupError.code || '');
    if (!user || !user.is_active || user.otp_login_enabled === false) return json({ error: 'Invalid username.' }, 400);
    const otp = generateOtp();
    const { error } = await sb.from('platform_otp_codes').insert({
      user_id: user.id, app: APP, purpose: 'login', code_hash: sha256Hex(otp),
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    if (error) return json({ error: 'Could not start verification. Please try again.' }, 500);
    try {
      const result = await sendOtpEmail({ to: email, subject: 'Your Accounting login code', html: otpEmailHtml(otp), mockLabel: 'Accounting email OTP', code: otp });
      return json({ step: 'otp', email, mocked: !!result.mocked, message: result.mocked ? 'Email not configured — code was logged to the server console.' : 'A 6-digit code has been sent to your email.' });
    } catch (error) { return json({ error: 'Could not send the verification email. Please try again shortly.' }, 500); }
  }

  if (action === 'login') {
    const email = String(body.email || '').toLowerCase().trim();
    const password = String(body.password || '');
    if (!email || !password) return json({ error: 'Email and password are required.' }, 400);
    if (await isLoginRateLimited(email)) return json({ error: 'Too many failed attempts. Try again in 15 minutes.' }, 429);

    const { data: user } = await sb.from('platform_users').select('id, email, password_hash, role, is_active').eq('email', email).maybeSingle();
    if (!user || !user.is_active) { await recordLoginAttempt(email, ip, false); return json({ error: 'Invalid email or password.' }, 401); }
    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) { await recordLoginAttempt(email, ip, false); return json({ error: 'Invalid email or password.' }, 401); }
    await recordLoginAttempt(email, ip, true);

    // Check accounting role
    /* Application access: no Accounting grant → no OTP, no session. */
    const superAdmin = isSuperAdminEmail(user.email);
    const { data: grants } = await sb.from('app_permissions').select('app_id, app_role').eq('user_id', user.id);
    const decision = loginDecision({ user, grants: grants || [], appId: APP, isSuperAdmin: superAdmin });
    if (!decision.allowed) return accessDenied(decision);
    const appRole = sessionRoleFor({ user, grant: (grants || []).find(g => g.app_id === APP) || null, isSuperAdmin: superAdmin });

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { error: otpInsertError } = await sb.from('platform_otp_codes').insert({
      user_id: user.id, app: APP, purpose: 'login', code_hash: sha256Hex(otp), expires_at: expiresAt,
    });
    if (otpInsertError) return json({ error: 'Could not start verification. Please try again.' }, 500);

    try {
      const result = await sendOtpEmail({ to: email, subject: 'Your Accounting login code', html: otpEmailHtml(otp), mockLabel: 'Accounting login OTP', code: otp });
      return json({ step: 'otp', email, mocked: !!result.mocked, message: result.mocked ? 'Email not configured — code was logged to the server console.' : `A verification code has been sent to ${email}.` });
    } catch (error) {
      console.error('[accounting/auth] OTP email failed:', error.message);
      return json({ error: 'Could not send the verification email. Please try again shortly.' }, 500);
    }
  }

  if (action === 'verify-otp') {
    const email = String(body.email || '').toLowerCase().trim();
    const code = String(body.code || '').trim();
    if (!email || !code) return json({ error: 'Email and code are required.' }, 400);

    const { data: user } = await sb.from('platform_users').select('id, email, role').eq('email', email).maybeSingle();
    if (!user) return json({ error: 'No pending verification. Please sign in again.' }, 400);

    const { data: otpRow } = await sb.from('platform_otp_codes')
      .select('*').eq('user_id', user.id).eq('app', APP).eq('purpose', 'login')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!otpRow) return json({ error: 'No pending verification. Please sign in again.' }, 400);
    if (otpRow.consumed_at) return json({ error: 'This code was already used. Please sign in again.' }, 400);
    if (new Date(otpRow.expires_at) < new Date()) return json({ error: 'Code expired. Please sign in again.' }, 400);
    if (otpRow.attempt_count >= 5) return json({ error: 'Too many attempts. Please sign in again.' }, 400);
    if (otpRow.code_hash !== sha256Hex(code)) {
      await sb.from('platform_otp_codes').update({ attempt_count: otpRow.attempt_count + 1 }).eq('id', otpRow.id);
      return json({ error: 'Invalid code.' }, 401);
    }
    await sb.from('platform_otp_codes').update({ consumed_at: new Date().toISOString() }).eq('id', otpRow.id);

    /* Application access: no Accounting grant → no OTP, no session. */
    const superAdmin = isSuperAdminEmail(user.email);
    const { data: grants } = await sb.from('app_permissions').select('app_id, app_role').eq('user_id', user.id);
    const decision = loginDecision({ user, grants: grants || [], appId: APP, isSuperAdmin: superAdmin });
    if (!decision.allowed) return accessDenied(decision);
    const appRole = sessionRoleFor({ user, grant: (grants || []).find(g => g.app_id === APP) || null, isSuperAdmin: superAdmin });

    const sessionUser = { id: user.id, email: user.email, role: appRole, apps: decision.apps };
    const token = signSession(sessionUser);
    const { error: sessionError } = await sb.from('platform_sessions').insert({
      user_id: user.id, app: APP, token_hash: sha256Hex(token), ip,
      user_agent: req.headers.get('user-agent') || '',
      expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString(),
    });
    if (sessionError) return json({ error: 'Could not complete sign-in. Please try again.' }, 500);
    const ssoToken = signSsoSession(sessionUser);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', sessionCookieHeader(token, SESSION_TTL_SECONDS, domain));
    headers.append('Set-Cookie', ssoCookieHeader(ssoToken, domain));
    return new Response(JSON.stringify({ user: { id: sessionUser.id, email: sessionUser.email, role: sessionUser.role }, apps: decision.apps, next: decision.next }), { status: 200, headers });
  }

  if (action === 'resend-otp') {
    const email = String(body.email || '').toLowerCase().trim();
    const { data: user } = await sb.from('platform_users').select('id, email').eq('email', email).maybeSingle();
    if (!user) return json({ error: 'Invalid request.' }, 400);

    const { data: last } = await sb.from('platform_otp_codes')
      .select('created_at').eq('user_id', user.id).eq('app', APP).eq('purpose', 'login')
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (last) {
      const elapsed = (Date.now() - new Date(last.created_at).getTime()) / 1000;
      if (elapsed < 60) return json({ error: 'Please wait before requesting another code.', retryAfter: Math.ceil(60 - elapsed) }, 429);
    }
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const { error: otpInsertError } = await sb.from('platform_otp_codes').insert({
      user_id: user.id, app: APP, purpose: 'login', code_hash: sha256Hex(otp), expires_at: expiresAt,
    });
    if (otpInsertError) return json({ error: 'Could not start verification. Please try again.' }, 500);
    try {
      const result = await sendOtpEmail({ to: email, subject: 'Your Accounting login code', html: otpEmailHtml(otp), mockLabel: 'Accounting resend OTP', code: otp });
      return json({ mocked: !!result.mocked, message: result.mocked ? 'Email not configured — code was logged to the server console.' : 'A new code has been sent.' });
    } catch (error) {
      return json({ error: 'Could not send the verification email.' }, 500);
    }
  }

  if (action === 'logout') {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', clearCookieHeader(domain));
    for (const h of clearSsoCookieHeaders(domain)) headers.append('Set-Cookie', h);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  return json({ error: 'Unknown action.' }, 400);
}
