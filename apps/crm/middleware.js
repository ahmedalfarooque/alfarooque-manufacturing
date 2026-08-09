import { jwtVerify } from 'jose';
import { NextResponse } from 'next/server';

const COOKIE_NAME = 'af_crm_session';
const SSO_COOKIE_NAME = 'af_sso_session';

const PROTECTED = ['/dashboard', '/contacts', '/deals', '/activities', '/pipeline', '/reports', '/settings'];
const ADMIN_ONLY = ['/settings'];

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

  const session = (await verifyJwt(appToken)) || (await verifySso(ssoToken));
  if (!session) return NextResponse.redirect(new URL('/login', req.url));

  const isAdmin = ADMIN_ONLY.some(p => pathname === p || pathname.startsWith(p + '/'));
  if (isAdmin && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*', '/contacts/:path*', '/deals/:path*', '/activities/:path*', '/pipeline/:path*', '/reports/:path*', '/settings/:path*'] };
