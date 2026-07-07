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

const ADMIN_ONLY_PREFIXES = ['/projects/new', '/projects/edit', '/purchase-requests'];

/* This app has no basePath (it lives at the root of
   projects.alfarooque.com), so req.nextUrl.basePath is always '' here —
   kept as a helper anyway so redirects stay correct if a basePath is
   ever reintroduced. */
function redirectTo(req, path) {
  return NextResponse.redirect(new URL(req.nextUrl.basePath + path, req.url));
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verify(token) : null;

  /* One login page (/login) with a switch between "User" (email-only
     OTP, view access — always the default) and "Admin" (email+
     password) — the switch changes only the credentials box, not the
     route. /view-login still exists as a redirect into /login for any
     old links. Neither requires a session; both bounce an
     already-logged-in visitor straight to the dashboard instead of
     re-showing a login form. */
  if (pathname.startsWith('/login') || pathname.startsWith('/view-login')) {
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
  matcher: ['/dashboard/:path*', '/projects/:path*', '/customers/:path*', '/reports/:path*', '/view/:path*', '/purchase-requests/:path*'],
};
