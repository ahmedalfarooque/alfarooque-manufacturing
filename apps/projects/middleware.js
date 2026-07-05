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

/* NextResponse.redirect(new URL(path, req.url)) does NOT automatically
   prepend this app's basePath ('/projects') — confirmed by direct
   testing; a bare '/login' redirect target 404s since the app's entire
   route tree lives under /projects. req.nextUrl.basePath holds the
   configured basePath at runtime, so every redirect below is built
   through this helper instead of a raw `new URL(path, req.url)`. */
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
  matcher: ['/dashboard/:path*', '/projects/:path*', '/customers/:path*', '/reports/:path*', '/view/:path*'],
};
