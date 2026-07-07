'use strict';

/* GET is open to any authenticated user (admin or viewer) — used to
   populate the "Assigned Users" picker in the Add/Edit Project modal,
   which any logged-in user can view even though only an admin can act
   on it. POST (create a new platform_users row) is admin-only and
   returns a one-time plaintext temporary password for the admin to
   share with the new user — there's no invite-email flow yet, so this
   is the only place that password is ever visible. */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

function generateTempPassword() {
  // 10 chars, easy to read aloud/type: letters+digits, no ambiguous 0/O/1/l
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = crypto.randomBytes(10);
  for (let i = 0; i < 10; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data, error } = await sb
    .from('platform_users')
    .select('id, full_name, email, position, role, is_active')
    .order('full_name', { ascending: true });
  if (error) { console.error('[users] list failed:', error.message); return json({ error: 'Could not load users.' }, 500); }
  return json({ users: data });
}

export async function POST(req) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const fullName = String(body.full_name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const position = String(body.position || '').trim() || null;
  const role = body.role === 'admin' ? 'admin' : 'viewer';
  if (!fullName) return json({ error: 'Full name is required.' }, 400);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'A valid email is required.' }, 400);

  const sb = getDb();
  const { data: existing } = await sb.from('platform_users').select('id').eq('email', email).maybeSingle();
  if (existing) return json({ error: 'A user with this email already exists.' }, 409);

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const { data: user, error } = await sb.from('platform_users').insert({
    full_name: fullName,
    email,
    position,
    role,
    password_hash: passwordHash,
    must_change_password: true,
    is_active: true,
  }).select('id, full_name, email, position, role, is_active').single();

  if (error) {
    console.error('[users] create failed:', error.message);
    return json({ error: 'Could not create the user.' }, 500);
  }

  return json({ user, temp_password: tempPassword }, 201);
}
