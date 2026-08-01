'use strict';

const bcrypt = require('bcryptjs');
const { getDb } = require('@/lib/db');
const { json } = require('@/lib/http');
const {
  APP, COOKIE_NAME, SESSION_TTL_SECONDS,
  sha256Hex, generateOtp, signSession, readSession,
  parseCookies, sessionCookieHeader, clearCookieHeader,
  isLoginRateLimited, recordLoginAttempt,
} = require('@/lib/auth');
const { signSsoSession, ssoCookieHeader, clearSsoCookieHeaders, clearAllAppCookieHeaders, cookieDomainFromReq } = require('@/lib/sso');

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
    const { data: roleRow } = await sb.from('acc_user_roles').select('role').eq('user_id', user.id).maybeSingle();
    const appRole = roleRow?.role || (user.role === 'admin' ? 'admin' : 'viewer');

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await sb.from('otp_codes').delete().eq('email', email).eq('app', APP);
    await sb.from('otp_codes').insert({ email, app: APP, code_hash: sha256Hex(otp), expires_at: expiresAt, attempts: 0 });

    console.log(`[accounting/auth] OTP for ${email}: ${otp}`);
    return json({ message: `A verification code has been sent to ${email}.` });
  }

  if (action === 'verify-otp') {
    const email = String(body.email || '').toLowerCase().trim();
    const code = String(body.code || '').trim();
    if (!email || !code) return json({ error: 'Email and code are required.' }, 400);

    const { data: otpRow } = await sb.from('otp_codes').select('*').eq('email', email).eq('app', APP).maybeSingle();
    if (!otpRow) return json({ error: 'No pending verification. Please sign in again.' }, 400);
    if (new Date(otpRow.expires_at) < new Date()) { await sb.from('otp_codes').delete().eq('id', otpRow.id); return json({ error: 'Code expired. Please sign in again.' }, 400); }
    if (otpRow.attempts >= 5) { await sb.from('otp_codes').delete().eq('id', otpRow.id); return json({ error: 'Too many attempts. Please sign in again.' }, 400); }
    if (otpRow.code_hash !== sha256Hex(code)) {
      await sb.from('otp_codes').update({ attempts: otpRow.attempts + 1 }).eq('id', otpRow.id);
      return json({ error: 'Invalid code.' }, 401);
    }
    await sb.from('otp_codes').delete().eq('id', otpRow.id);

    const { data: user } = await sb.from('platform_users').select('id, email, role').eq('email', email).maybeSingle();
    if (!user) return json({ error: 'User not found.' }, 404);
    const { data: roleRow } = await sb.from('acc_user_roles').select('role').eq('user_id', user.id).maybeSingle();
    const appRole = roleRow?.role || (user.role === 'admin' ? 'admin' : 'viewer');

    const sessionUser = { id: user.id, email: user.email, role: appRole };
    const token = signSession(sessionUser);
    const ssoToken = signSsoSession(sessionUser);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', sessionCookieHeader(token, SESSION_TTL_SECONDS, domain));
    headers.append('Set-Cookie', ssoCookieHeader(ssoToken, domain));
    return new Response(JSON.stringify({ user: sessionUser }), { status: 200, headers });
  }

  if (action === 'resend-otp') {
    const email = String(body.email || '').toLowerCase().trim();
    const { data: otpRow } = await sb.from('otp_codes').select('created_at').eq('email', email).eq('app', APP).maybeSingle();
    if (otpRow) {
      const elapsed = (Date.now() - new Date(otpRow.created_at).getTime()) / 1000;
      if (elapsed < 60) return json({ error: 'Please wait before requesting another code.', retryAfter: Math.ceil(60 - elapsed) }, 429);
    }
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await sb.from('otp_codes').delete().eq('email', email).eq('app', APP);
    await sb.from('otp_codes').insert({ email, app: APP, code_hash: sha256Hex(otp), expires_at: expiresAt, attempts: 0 });
    console.log(`[accounting/auth] Resend OTP for ${email}: ${otp}`);
    return json({ message: 'A new code has been sent.' });
  }

  if (action === 'logout') {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', clearCookieHeader(domain));
    for (const h of clearSsoCookieHeaders(domain)) headers.append('Set-Cookie', h);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  return json({ error: 'Unknown action.' }, 400);
}
