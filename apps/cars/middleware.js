import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'af_cars_session';

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

const ADMIN_ONLY_PREFIXES = ['/vehicles/new', '/vehicles/edit'];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verify(token) : null;

  if (pathname.startsWith('/login')) {
    if (session) return NextResponse.redirect(new URL('/dashboard', req.url));
    return NextResponse.next();
  }

  if (!session) {
    const url = new URL('/login', req.url);
    return NextResponse.redirect(url);
  }

  if (ADMIN_ONLY_PREFIXES.some(p => pathname.startsWith(p)) && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/vehicles/:path*', '/maintenance/:path*', '/alerts/:path*', '/reports/:path*'],
};
