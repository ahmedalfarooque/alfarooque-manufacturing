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

/* NextResponse.redirect(new URL(path, req.url)) does NOT automatically
   prepend this app's basePath ('/cars') — confirmed by direct testing;
   a bare '/login' redirect target 404s since the app's entire route
   tree lives under /cars. req.nextUrl.basePath holds the configured
   basePath at runtime, so every redirect below is built through this
   helper instead of a raw `new URL(path, req.url)`. */
function redirectTo(req, path) {
  return NextResponse.redirect(new URL(req.nextUrl.basePath + path, req.url));
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verify(token) : null;

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
  matcher: ['/dashboard/:path*', '/vehicles/:path*', '/maintenance/:path*', '/alerts/:path*', '/reports/:path*'],
};
