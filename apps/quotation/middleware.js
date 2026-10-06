import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { isSuperAdminEmail } from './lib/superAdmin';
import { sessionCanEnterApp } from '../shared/appAccess';

const APP_ID = 'quotation';

const COOKIE_NAME = 'af_quotation_session';
const SSO_COOKIE_NAME = 'af_sso_session';

async function verify(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (_) {
    return null;
  }
}

/* Cross-app SSO fallback (jose — Edge runtime). Accepts any authenticated
   user carrying the sso flag — extended to all roles so non-admin staff
   can switch apps. Mirrors lib/sso.js verifySsoSession. */
async function verifySso(token) {
  try {
    const secret = new TextEncoder().encode(process.env.SSO_JWT_SECRET || process.env.JWT_SECRET || '');
    const { payload } = await jwtVerify(token, secret);
    return payload && payload.sso === true ? payload : null;
  } catch (_) {
    return null;
  }
}

async function readAnySession(req) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verify(token) : null;
  if (session) return { session, viaSso: false };
  const ssoToken = req.cookies.get(SSO_COOKIE_NAME)?.value;
  const sso = ssoToken ? await verifySso(ssoToken) : null;
  return { session: sso, viaSso: !!sso };
}

/* Admin-only areas. Finer-grained permissions (costs.view etc.) are
   enforced inside API routes against qt_role_permissions — middleware
   only does the coarse session/role gate, same as apps/projects. */
const ADMIN_ONLY_PREFIXES = ['/users', '/settings', '/audit'];

function redirectTo(req, path) {
  return NextResponse.redirect(new URL(req.nextUrl.basePath + path, req.url));
}

/* Effective role must match lib/auth.js readSession (super-admin
   override) or the page gate and the API disagree — see apps/cars. */
function effectiveSession(session) {
  if (!session) return null;
  if (isSuperAdminEmail(session.email)) return { ...session, role: 'admin' };
  return session;
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const { session: rawSession, viaSso } = await readAnySession(req);
  const session = effectiveSession(rawSession);

  if (pathname.startsWith('/login')) {
    if (session) return redirectTo(req, '/dashboard');
    return NextResponse.next();
  }

  if (!session) {
    return redirectTo(req, '/login');
  }

  /* Application access ("may this user enter quotation at all?"). Sessions
     minted since the app-access release carry an `apps` claim; a session
     without the claim is a legacy token — the app's own cookie is still
     honoured (its login already checked the grant), but a legacy SSO
     token from a sibling app is not. The API layer enforces the grant
     independently (shared moduleAuthorization). */
  const can = sessionCanEnterApp(session, APP_ID);
  if (can === false || (can === null && viaSso)) {
    return redirectTo(req, '/no-access');
  }

  /* Admin-only pages: a clear forbidden page, never a silent bounce. */
  if (ADMIN_ONLY_PREFIXES.some(p => pathname.startsWith(p)) && session.role !== 'admin') {
    return redirectTo(req, '/forbidden?from=' + encodeURIComponent(pathname));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/launch/:path*',
    '/dashboard/:path*', '/quotations/:path*', '/customers/:path*',
    '/catalogue/:path*', '/materials/:path*', '/suppliers/:path*',
    '/labour/:path*', '/machines/:path*', '/expenses/:path*',
    '/reports/:path*', '/users/:path*', '/settings/:path*', '/audit/:path*',
  ],
};
