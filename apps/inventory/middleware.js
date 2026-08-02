import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'af_inventory_session';
const SSO_COOKIE_NAME = 'af_sso_session';

/* Edge-runtime middleware — uses `jose` (not `jsonwebtoken`) because
   the Node.js `crypto` module isn't available in the Edge runtime.
   This only gates PAGE navigation; every API route also independently
   verifies the session server-side (defense in depth). */
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
   user carrying the sso flag — extended to all roles so all ERP staff
   can switch apps seamlessly. Mirrors lib/sso.js verifySsoSession. */
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
  if (session) return session;
  const ssoToken = req.cookies.get(SSO_COOKIE_NAME)?.value;
  return ssoToken ? await verifySso(ssoToken) : null;
}

/* Settings and user management are admin-only; everything else is
   accessible to any authenticated user (per-action permission checks
   happen inside the API routes via lib/perms.js). */
const ADMIN_ONLY_PREFIXES = ['/settings'];

function redirectTo(req, path) {
  return NextResponse.redirect(new URL(req.nextUrl.basePath + path, req.url));
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const session = await readAnySession(req);

  if (pathname.startsWith('/login')) {
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
  matcher: [
    '/dashboard/:path*', '/products/:path*', '/materials/:path*',
    '/categories/:path*', '/suppliers/:path*', '/warehouses/:path*',
    '/locations/:path*', '/stock/:path*', '/stock-movements/:path*',
    '/reservations/:path*', '/transfers/:path*',
    '/purchase-requests/:path*', '/purchase-orders/:path*',
    '/goods-receipts/:path*', '/goods-issues/:path*',
    '/reports/:path*', '/settings/:path*',
  ],
};
