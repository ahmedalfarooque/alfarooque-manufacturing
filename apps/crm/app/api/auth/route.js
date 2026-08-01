'use strict';

const { getDb } = require('@/lib/db');
const { json } = require('@/lib/http');
const bcrypt = require('bcryptjs');
const {
  APP, COOKIE_NAME, SESSION_TTL_SECONDS, OTP_TTL_MINUTES, OTP_RESEND_COOLDOWN_SECONDS,
  OTP_MAX_ATTEMPTS, sha256Hex, generateOtp, signSession, readSession,
  sessionCookieHeader, clearCookieHeader, isLoginRateLimited, recordLoginAttempt,
} = require('@/lib/auth');
const { SSO_COOKIE_NAME, signSsoSession, ssoCookieHeader, clearSsoCookieHeader } = require('@/lib/sso');
const { isSuperAdminEmail } = require('@/lib/superAdmin');

export async function GET(req) {
  const session = readSession(req);
  if (!session) return json({ error: 'Not authenticated.' }, 401);
  return json({ user: session });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { action } = body;
  const sb = getDb();

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
    await sb.from('otp_codes').upsert({ email, app: APP, otp_hash: sha256Hex(otp), expires_at: expiresAt, attempts: 0 }, { onConflict: 'email,app' });
    console.log(`[crm] OTP for ${email}: ${otp}`);
    return json({ ok: true, message: `OTP sent to ${email}` });
  }

  if (action === 'verify-otp') {
    const email = String(body.email || '').trim().toLowerCase();
    const otp = String(body.otp || '').trim();
    if (!email || !otp) return json({ error: 'Email and OTP are required.' }, 400);

    const { data: record } = await sb.from('otp_codes').select('*').eq('email', email).eq('app', APP).maybeSingle();
    if (!record) return json({ error: 'No OTP found. Please login again.' }, 400);
    if (new Date(record.expires_at) < new Date()) return json({ error: 'OTP has expired.' }, 400);
    if ((record.attempts || 0) >= OTP_MAX_ATTEMPTS) return json({ error: 'Too many OTP attempts.' }, 400);

    if (record.otp_hash !== sha256Hex(otp)) {
      await sb.from('otp_codes').update({ attempts: (record.attempts || 0) + 1 }).eq('email', email).eq('app', APP);
      return json({ error: 'Invalid OTP.' }, 401);
    }

    await sb.from('otp_codes').delete().eq('email', email).eq('app', APP);
    const { data: user } = await sb.from('platform_users').select('id, email, role').eq('email', email).maybeSingle();
    if (!user) return json({ error: 'User not found.' }, 404);

    let role = user.role === 'admin' ? 'admin' : 'viewer';
    if (isSuperAdminEmail(email)) role = 'admin';
    else {
      const { data: appRole } = await sb.from('crm_user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (appRole) role = appRole.role;
    }

    const sessionUser = { id: user.id, email: user.email, role };
    const token = signSession(sessionUser);
    const ssoToken = signSsoSession(sessionUser);
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', sessionCookieHeader(token, SESSION_TTL_SECONDS));
    headers.append('Set-Cookie', ssoCookieHeader(ssoToken, SESSION_TTL_SECONDS));
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  if (action === 'resend-otp') {
    const email = String(body.email || '').trim().toLowerCase();
    const { data: record } = await sb.from('otp_codes').select('created_at').eq('email', email).eq('app', APP).maybeSingle();
    if (record) {
      const secondsSince = (Date.now() - new Date(record.created_at).getTime()) / 1000;
      if (secondsSince < OTP_RESEND_COOLDOWN_SECONDS) return json({ error: `Please wait ${Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSince)}s before resending.` }, 429);
    }
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
    await sb.from('otp_codes').upsert({ email, app: APP, otp_hash: sha256Hex(otp), expires_at: expiresAt, attempts: 0 }, { onConflict: 'email,app' });
    console.log(`[crm] Resend OTP for ${email}: ${otp}`);
    return json({ ok: true });
  }

  if (action === 'logout') {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    headers.append('Set-Cookie', clearCookieHeader());
    headers.append('Set-Cookie', clearSsoCookieHeader());
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  return json({ error: 'Invalid action.' }, 400);
}
