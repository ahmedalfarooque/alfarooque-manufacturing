'use strict';

/* Current user's quotation-app role + permissions (drives UI gating),
   plus self-service profile editing (name, email, password). Every
   write here is scoped to `session.sub` — there is no user_id
   parameter accepted from the client — so this can never be used to
   edit anyone else's account; role/is_active stay admin-only (see
   /api/admin/users) since those are security-sensitive. */

const bcrypt = require('bcryptjs');
const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { getQRole, PERMS } = require('@/lib/perms');
const { audit } = require('@/lib/crud');
const { signSession, sessionCookieHeader, SESSION_TTL_SECONDS } = require('@/lib/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET(req) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const sb = getDb();
  const qrole = await getQRole(sb, session);
  const { data: row } = await sb.from('platform_users').select('full_name').eq('id', session.sub).maybeSingle();
  return json({
    user: { id: session.sub, email: session.email, full_name: row?.full_name || '', role: session.role },
    qrole, perms: PERMS[qrole] || [],
  });
}

export async function PATCH(req) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const body = await req.json().catch(() => ({}));
  const sb = getDb();

  const fullName = body.full_name !== undefined ? String(body.full_name).trim() : undefined;
  const email = body.email !== undefined ? String(body.email).trim().toLowerCase() : undefined;
  const currentPassword = body.current_password ? String(body.current_password) : '';
  const newPassword = body.new_password ? String(body.new_password) : '';

  if (email !== undefined && !EMAIL_RE.test(email)) return json({ error: 'Please enter a valid email.' }, 400);
  if (newPassword && newPassword.length < 8) return json({ error: 'New password must be at least 8 characters.' }, 400);

  const { data: existing, error: fetchErr } = await sb.from('platform_users').select('*').eq('id', session.sub).maybeSingle();
  if (fetchErr || !existing) return json({ error: 'Account not found.' }, 404);

  const patch = {};
  if (fullName !== undefined) patch.full_name = fullName;
  if (email !== undefined && email !== existing.email) patch.email = email;
  if (newPassword) {
    if (!currentPassword) return json({ error: 'Enter your current password to set a new one.' }, 400);
    const ok = await bcrypt.compare(currentPassword, existing.password_hash);
    if (!ok) return json({ error: 'Current password is incorrect.' }, 401);
    patch.password_hash = await bcrypt.hash(newPassword, 10);
  }
  if (Object.keys(patch).length === 0) return json({ ok: true, user: sanitize(existing) });

  const { data: updated, error } = await sb.from('platform_users').update(patch).eq('id', session.sub).select('*').maybeSingle();
  if (error) {
    if (error.code === '23505') return json({ error: 'That email is already in use.' }, 409);
    return json({ error: error.message }, 500);
  }
  await audit(sb, 'platform_users', session.sub, 'update',
    { full_name: existing.full_name, email: existing.email }, { full_name: updated.full_name, email: updated.email }, session.sub);

  const res = json({ ok: true, user: sanitize(updated) });
  /* Re-sign the session so `session.email` (embedded in the JWT and
     checked by isSuperAdminEmail elsewhere) reflects an email change
     immediately, without forcing a re-login. */
  if (patch.email) {
    const token = signSession(updated);
    res.headers.set('Set-Cookie', sessionCookieHeader(token, SESSION_TTL_SECONDS));
  }
  return res;
}

function sanitize(u) { return { id: u.id, email: u.email, full_name: u.full_name, role: u.role }; }
