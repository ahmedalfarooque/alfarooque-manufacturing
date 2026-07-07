'use strict';

/* Admin-only edit of an existing platform_users row — role, status,
   and profile fields. Never touches password_hash (that's the
   create-time temp password / OTP-only design; there's no "reset
   password" flow here, matching the create route's model). */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = ['full_name', 'position', 'phone', 'department', 'company', 'photo_url', 'status', 'otp_login_enabled', 'is_active'];
const ROLES = ['admin', 'viewer', 'external'];
const STATUSES = ['Active', 'Inactive', 'Blocked'];

export async function PATCH(req, { params }) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  for (const key of EDITABLE) if (key in body) patch[key] = body[key];
  if ('role' in body) {
    if (!ROLES.includes(body.role)) return json({ error: 'Invalid role.' }, 400);
    if (params.id === session.sub && body.role !== 'admin') return json({ error: 'You cannot remove your own admin role.' }, 400);
    patch.role = body.role;
  }
  if ('status' in patch && !STATUSES.includes(patch.status)) return json({ error: 'Invalid status.' }, 400);
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('platform_users').update(patch).eq('id', params.id)
    .select('id, full_name, email, position, role, is_active, phone, department, photo_url, company, status, otp_login_enabled').maybeSingle();
  if (error) { console.error('[users] update failed:', error.message); return json({ error: 'Could not update user.' }, 500); }
  if (!data) return json({ error: 'User not found.' }, 404);
  return json({ user: data });
}
