import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'af_projects_session';

async function verify(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (_) {
    return null;
  }
}

const ADMIN_ONLY_PREFIXES = ['/projects/new', '/projects/edit'];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verify(token) : null;

  if (pathname.startsWith('/login')) {
    if (session) return NextResponse.redirect(new URL('/dashboard', req.url));
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (ADMIN_ONLY_PREFIXES.some(p => pathname.startsWith(p)) && session.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/projects/:path*', '/customers/:path*', '/reports/:path*'],
};
