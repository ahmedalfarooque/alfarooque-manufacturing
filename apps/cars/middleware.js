import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { isSuperAdminEmail } from './lib/superAdmin';
import { sessionCanEnterApp } from '../shared/appAccess';

const APP_ID = 'cars';
const COOKIE_NAME = 'af_cars_session';
const SSO_COOKIE_NAME = 'af_sso_session';

/* Edge-runtime middleware — uses `jose` (not `jsonwebtoken`) because
   the Node.js `crypto` module isn't available in the Edge runtime.
   This only gates PAGE navigation; every API route also independently
   verifies the session server-side (defense in depth — a hole in
   middleware must never be the only thing standing between a request
   and the database). */
async function verify(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (_) {
    return null;
  }
}

/* Cross-app SSO fallback (jose — Edge runtime). Mirrors lib/sso.js
   verifySsoSession. */
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

/* The effective role must be computed exactly the way lib/auth.js
   readSession computes it for every API route (super-admin override),
   otherwise the page gate and the API disagree: a super-admin session
   minted through the OTP-only "User" tab carries role 'readonly' in the
   JWT, the API treats it as admin (so the sidebar shows Users), but this
   gate used to bounce /users back to /dashboard. */
function effectiveSession(session) {
  if (!session) return null;
  if (isSuperAdminEmail(session.email)) return { ...session, role: 'admin' };
  return session;
}

const ADMIN_ONLY_PREFIXES = ['/users'];

/* This app has no basePath (it lives at the root of cars.alfarooque.com),
   so req.nextUrl.basePath is always '' here — kept as a helper anyway so
   redirects stay correct if a basePath is ever reintroduced. */
function redirectTo(req, path) {
  return NextResponse.redirect(new URL(req.nextUrl.basePath + path, req.url));
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const { session: raw, viaSso } = await readAnySession(req);
  const session = effectiveSession(raw);

  /* One login page (/login) with a switch between "User" (email-only
     OTP, view access — always the default) and "Admin" (email+
     password) — the switch changes only the credentials box, not the
     route. /view-login still exists as a redirect into /login for any
     old links. */
  if (pathname.startsWith('/login') || pathname.startsWith('/view-login')) {
    if (session) return redirectTo(req, '/dashboard');
    return NextResponse.next();
  }

  if (!session) {
    return redirectTo(req, '/login');
  }

  /* Application access ("may this user enter Cars at all?"). Sessions
     minted since the app-access release carry an `apps` claim; a session
     without the claim is a legacy token — the app's own cookie is still
     honoured (its login already checked the grant), but a legacy SSO
     token from a sibling app is not, because SSO was only ever meant for
     admins. The API layer enforces the grant independently. */
  const can = sessionCanEnterApp(session, APP_ID);
  if (can === false || (can === null && viaSso)) {
    return redirectTo(req, '/no-access');
  }

  /* Admin-only pages: a clear forbidden page, never a silent bounce to
     the dashboard. */
  if (ADMIN_ONLY_PREFIXES.some(p => pathname.startsWith(p)) && session.role !== 'admin') {
    return redirectTo(req, '/forbidden?from=' + encodeURIComponent(pathname));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/launch/:path*', '/dashboard/:path*', '/vehicles/:path*', '/drivers/:path*', '/maintenance/:path*', '/maintenance-schedule/:path*', '/maintenance-shops/:path*', '/insurance/:path*', '/inspection/:path*', '/alerts/:path*', '/reports/:path*', '/view/:path*', '/users/:path*'],
};
