'use strict';

/* Accounting-app roles and session permissions.
   Identity lives in the shared platform_users table; the role carried inside
   the JWT is scoped to app='accounting'.  A platform 'admin' is always an
   accounting admin.  Everyone else defaults to 'viewer'.

   Supported roles (least → most privileged):
     viewer     – read-only access to reports
     ar         – accounts receivable: can record receipts and view AR reports
     ap         – accounts payable: can post invoices/payments and view AP reports
     accountant – full ledger write access, can approve entries and run all reports
     admin      – full access including user management and configuration

   readSession() accepts either the accounting-specific JWT cookie
   ("af_accounting_session") or the platform-wide SSO cookie
   ("af_sso_session") so cross-app navigation works without re-login.
   Uses jose (async jwtVerify) with the JWT_SECRET environment variable. */

const { jwtVerify } = require('jose');

const ACCOUNTING_COOKIE = 'af_accounting_session';
const SSO_COOKIE        = 'af_sso_session';
const SUPER_ADMIN_EMAIL = 'arshad@alfarooque.com';

const ROLES = ['admin', 'accountant', 'ap', 'ar', 'viewer'];

const PERMS = {
  admin:      ['write', 'manage', 'approve', 'reports', 'admin'],
  accountant: ['write', 'approve', 'reports'],
  ap:         ['write', 'reports'],
  ar:         ['write', 'reports'],
  viewer:     ['reports'],
};

const WRITE_ROLES = ROLES.filter(r => PERMS[r].includes('write'));

/* Returns a Uint8Array key derived from JWT_SECRET for jose. Throws at
   call-time (not module load) so startup is not blocked if the env var
   will be injected later by the container runtime. */
function jwtSecretKey() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not configured.');
  return new TextEncoder().encode(s);
}

function parseCookies(cookieHeader) {
  const out = {};
  (cookieHeader || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

/* Verifies a single JWT string with jose; returns the payload or null. */
async function decodeJwt(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwtSecretKey());
    return payload;
  } catch (_) { return null; }
}

/* Reads the accounting session cookie ("af_accounting_session") and
   JWT-decodes it using jose and JWT_SECRET.  If not present or invalid,
   falls back to the platform SSO cookie ("af_sso_session").
   Returns { id, email, role } or null. */
async function readSession(req) {
  const header = req.headers && (req.headers.get
    ? req.headers.get('cookie')
    : req.headers.cookie);
  const cookies = parseCookies(header);

  /* Prefer the app-scoped cookie; fall back to SSO. */
  let payload = await decodeJwt(cookies[ACCOUNTING_COOKIE]);
  if (!payload) payload = await decodeJwt(cookies[SSO_COOKIE]);
  if (!payload) return null;

  const session = {
    id:    payload.sub   || payload.id   || null,
    email: payload.email || null,
    role:  ROLES.includes(payload.role) ? payload.role : 'viewer',
  };

  /* Super-admin override: the master account is always treated as admin. */
  if (session.email === SUPER_ADMIN_EMAIL) session.role = 'admin';

  return session;
}

/* Returns true if the session holder may create or modify accounting records.
   Roles: admin, accountant (ap and ar have narrower write rights handled at
   the route level via canWrite + role checks). */
function canWrite(session) {
  if (!session) return false;
  return session.role === 'admin' || session.role === 'accountant';
}

/* Returns true if the session holder may perform administrative actions:
   user management, configuration, period close/reopen. */
function canManage(session) {
  if (!session) return false;
  return session.role === 'admin';
}

/* Returns true for the master super-admin account or any admin-role session.
   Super-admin is identified by email so it survives role changes in the DB. */
function isSuperAdmin(session) {
  if (!session) return false;
  return session.email === SUPER_ADMIN_EMAIL || session.role === 'admin';
}

/* Generic permission check against the PERMS table. */
function can(role, perm) { return (PERMS[role] || []).includes(perm); }

module.exports = {
  ROLES,
  PERMS,
  WRITE_ROLES,
  readSession,
  canWrite,
  canManage,
  isSuperAdmin,
  can,
};
