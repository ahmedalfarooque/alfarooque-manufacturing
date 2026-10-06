import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { isSuperAdminEmail } from './lib/superAdmin';
import { sessionCanEnterApp } from '../shared/appAccess';

const APP_ID = 'projects';

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

const ADMIN_ONLY_PREFIXES = ['/users'];
const EXTERNAL_BLOCKED_PREFIXES = ['/customers'];

/* This app has no basePath (it lives at the root of
   projects.alfarooque.com), so req.nextUrl.basePath is always '' here —
   kept as a helper anyway so redirects stay correct if a basePath is
   ever reintroduced. */
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

  /* Application access ("may this user enter projects at all?"). Sessions
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

  if (EXTERNAL_BLOCKED_PREFIXES.some(p => pathname.startsWith(p)) && session.role === 'external') {
    return redirectTo(req, '/dashboard');
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/launch/:path*','/dashboard/:path*', '/projects/:path*', '/customers/:path*', '/reports/:path*', '/view/:path*', '/purchase-requests/:path*', '/quotation-requests/:path*', '/users/:path*', '/orders/:path*', '/orders-deleted/:path*', '/quotes/:path*', '/quotes-deleted/:path*', '/sales-orders/:path*'],
};
