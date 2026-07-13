import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

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

/* Cross-app SSO fallback (jose — Edge runtime). Accepted ONLY for admin
   payloads carrying the sso flag, so no other role can cross apps.
   Mirrors lib/sso.js verifySsoSession. */
async function verifySso(token) {
  try {
    const secret = new TextEncoder().encode(process.env.SSO_JWT_SECRET || process.env.JWT_SECRET || '');
    const { payload } = await jwtVerify(token, secret);
    return payload && payload.sso === true && payload.role === 'admin' ? payload : null;
  } catch (_) {
    return null;
  }
}

async function readAnySession(req) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verify(token) : null;
  if (session) return session;
  const ssoToken = req.cookies.get(SSO_COOKIE_NAME)?.value;
  return ssoToken ? await verifySso(ssoToken) : null;
}

const ADMIN_ONLY_PREFIXES = ['/vehicles/new', '/vehicles/edit'];

/* This app has no basePath (it lives at the root of cars.alfarooque.com),
   so req.nextUrl.basePath is always '' here — kept as a helper anyway so
   redirects stay correct if a basePath is ever reintroduced. */
function redirectTo(req, path) {
  return NextResponse.redirect(new URL(req.nextUrl.basePath + path, req.url));
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const session = await readAnySession(req);

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

  if (ADMIN_ONLY_PREFIXES.some(p => pathname.startsWith(p)) && session.role !== 'admin') {
    return redirectTo(req, '/dashboard');
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/vehicles/:path*', '/drivers/:path*', '/maintenance/:path*', '/maintenance-schedule/:path*', '/maintenance-shops/:path*', '/alerts/:path*', '/reports/:path*', '/view/:path*'],
};
