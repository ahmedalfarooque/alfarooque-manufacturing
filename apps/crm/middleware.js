import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';
import { isSuperAdminEmail } from './lib/superAdmin';
import { sessionCanEnterApp } from '../shared/appAccess';

const APP_ID = 'crm';

const COOKIE_NAME = 'af_crm_session';
const SSO_COOKIE_NAME = 'af_sso_session';

const PROTECTED = ['/launch', '/dashboard', '/contacts', '/deals', '/activities', '/pipeline', '/integrations', '/reports', '/settings', '/users'];
const ADMIN_ONLY = ['/settings', '/users'];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (!isProtected) return NextResponse.next();

  const secret = process.env.JWT_SECRET;
  if (!secret) return NextResponse.redirect(new URL('/login', req.url));

  const enc = new TextEncoder().encode(secret);
  /* Cross-app SSO cookie is signed with SSO_JWT_SECRET (falling back to
     JWT_SECRET if unset), same as every other app's lib/sso.js — using
     JWT_SECRET unconditionally here would silently reject a valid SSO
     cookie whenever the two secrets are configured differently. */
  const ssoEnc = new TextEncoder().encode(process.env.SSO_JWT_SECRET || secret);

  async function verifyJwt(token) {
    if (!token) return null;
    try { const { payload } = await jwtVerify(token, enc); return payload; } catch (_) { return null; }
  }
  async function verifySso(token) {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, ssoEnc);
      return payload && payload.sso === true ? payload : null;
    } catch (_) { return null; }
  }

  const cookies = req.cookies;
  const appToken = cookies.get(COOKIE_NAME)?.value;
  const ssoToken = cookies.get(SSO_COOKIE_NAME)?.value;

  const appSession = await verifyJwt(appToken);
  const rawSession = appSession || (await verifySso(ssoToken));
  const viaSso = !appSession && !!rawSession;
  if (!rawSession) return NextResponse.redirect(new URL('/login', req.url));
  /* Effective role must match lib/auth.js readSession (super-admin override). */
  const session = isSuperAdminEmail(rawSession.email) ? { ...rawSession, role: 'admin' } : rawSession;

  /* Application access: sessions minted since the app-access release carry
     an `apps` claim; a legacy SSO token from a sibling app is not trusted
     to enter CRM. API routes enforce the grant independently. */
  const can = sessionCanEnterApp(session, APP_ID);
  if (can === false || (can === null && viaSso)) {
    return NextResponse.redirect(new URL('/no-access', req.url));
  }

  const isAdmin = ADMIN_ONLY.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isAdmin && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/forbidden?from=' + encodeURIComponent(pathname), req.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ['/launch/:path*', '/dashboard/:path*', '/contacts/:path*', '/deals/:path*', '/activities/:path*', '/pipeline/:path*', '/integrations/:path*', '/reports/:path*', '/settings/:path*', '/users/:path*'] };
