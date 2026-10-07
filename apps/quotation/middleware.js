import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { isSuperAdminEmail } from './lib/superAdmin';
import { pageGate, effectiveSession } from '../shared/appAccess';

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


export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const { session: rawSession, viaSso } = await readAnySession(req);
  const session = effectiveSession(rawSession, isSuperAdminEmail(rawSession && rawSession.email));

  if (pathname.startsWith('/login')) {
    if (session) return redirectTo(req, '/dashboard');
    return NextResponse.next();
  }

  if (!session) {
    return redirectTo(req, '/login');
  }

  /* Shared, unit-tested page gate (apps/shared/appAccess.js): application
     access first (non-admins only), then admin-only pages. Never a silent
     bounce to the dashboard: no access -> /no-access, non-admin on an
     admin page -> /forbidden. User management never depends on the
     application-access rows. */
  const gate = pageGate({ session, viaSso, pathname, appId: APP_ID, adminOnlyPrefixes: ADMIN_ONLY_PREFIXES, loginPrefixes: [] });
  if (gate.action === 'no-access') return redirectTo(req, '/no-access');
  if (gate.action === 'forbidden') return redirectTo(req, '/forbidden?from=' + encodeURIComponent(pathname));

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
