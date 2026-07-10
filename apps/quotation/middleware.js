import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'af_quotation_session';

async function verify(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (_) {
    return null;
  }
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
  matcher: [
    '/dashboard/:path*', '/quotations/:path*', '/customers/:path*',
    '/catalogue/:path*', '/materials/:path*', '/suppliers/:path*',
    '/labour/:path*', '/machines/:path*', '/expenses/:path*',
    '/reports/:path*', '/users/:path*', '/settings/:path*', '/audit/:path*',
  ],
};
