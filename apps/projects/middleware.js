import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'af_projects_session';
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

const ADMIN_ONLY_PREFIXES = ['/projects/new', '/projects/edit', '/purchase-requests', '/quotation-requests', '/users', '/orders', '/orders-deleted', '/quotes', '/quotes-deleted'];
const EXTERNAL_BLOCKED_PREFIXES = ['/customers'];

/* This app has no basePath (it lives at the root of
   projects.alfarooque.com), so req.nextUrl.basePath is always '' here —
   kept as a helper anyway so redirects stay correct if a basePath is
   ever reintroduced. */
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
     old links. Neither requires a session; both bounce an
     already-logged-in visitor straight to the dashboard instead of
     re-showing a login form. */
  if (pathname.startsWith('/login') || pathname.startsWith('/view-login')) {
    if (session) {
      const redirect = req.nextUrl.searchParams.get('redirect');
      return redirectTo(req, redirect && redirect.startsWith('/') ? redirect : '/dashboard');
    }
    return NextResponse.next();
  }

  if (!session) {
    /* Preserve where the visitor was headed (e.g. a "View Request" email
       link, or the quotation app's "Open Project" link) so login can
       land them there instead of always the dashboard — Part 4/12. */
    const target = pathname + (req.nextUrl.search || '');
    return redirectTo(req, '/login?redirect=' + encodeURIComponent(target));
  }

  if (ADMIN_ONLY_PREFIXES.some(p => pathname.startsWith(p)) && session.role !== 'admin') {
    return redirectTo(req, '/dashboard');
  }

  if (EXTERNAL_BLOCKED_PREFIXES.some(p => pathname.startsWith(p)) && session.role === 'external') {
    return redirectTo(req, '/dashboard');
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/projects/:path*', '/customers/:path*', '/reports/:path*', '/view/:path*', '/purchase-requests/:path*', '/quotation-requests/:path*', '/users/:path*', '/orders/:path*', '/orders-deleted/:path*', '/quotes/:path*', '/quotes-deleted/:path*'],
};
