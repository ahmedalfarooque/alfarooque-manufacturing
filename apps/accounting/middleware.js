import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'af_accounting_session';
const SSO_COOKIE_NAME = 'af_sso_session';

async function verify(token) {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (_) { return null; }
}

async function verifySso(token) {
  try {
    const secret = new TextEncoder().encode(process.env.SSO_JWT_SECRET || process.env.JWT_SECRET || '');
    const { payload } = await jwtVerify(token, secret);
    return payload && payload.sso === true ? payload : null;
  } catch (_) { return null; }
}

async function readAnySession(req) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verify(token) : null;
  if (session) return session;
  const ssoToken = req.cookies.get(SSO_COOKIE_NAME)?.value;
  return ssoToken ? await verifySso(ssoToken) : null;
}

const ADMIN_ONLY_PREFIXES = ['/settings'];
const LOCAL_FINANCIAL_APIS = [
  '/api/chart-of-accounts', '/api/journal-entries', '/api/invoices', '/api/bills',
  '/api/payments', '/api/banking', '/api/expenses', '/api/assets', '/api/dashboard', '/api/reports',
];
const LEGACY_FINANCIAL_PAGES = [
  '/dashboard', '/chart-of-accounts', '/journal-entries', '/invoices', '/bills',
  '/payments', '/banking', '/expenses', '/assets', '/reports',
];

function redirectTo(req, path) {
  return NextResponse.redirect(new URL(req.nextUrl.basePath + path, req.url));
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const session = await readAnySession(req);

  if (LOCAL_FINANCIAL_APIS.some(p => pathname.startsWith(p))) {
    return NextResponse.json({ error: 'This local financial API is retired. SmartLife is the financial source of truth.' }, { status: 410 });
  }

  if (pathname.startsWith('/login')) {
    if (session) return redirectTo(req, '/smartlife/sales-invoices');
    return NextResponse.next();
  }

  if (!session) return redirectTo(req, '/login');

  if (LEGACY_FINANCIAL_PAGES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    const target = pathname.startsWith('/bills') ? '/smartlife/purchase-invoices'
      : pathname.startsWith('/payments') ? '/smartlife/payments'
      : pathname.startsWith('/reports') ? '/smartlife/financial-reports'
      : '/smartlife/sales-invoices';
    return redirectTo(req, target);
  }

  if (ADMIN_ONLY_PREFIXES.some(p => pathname.startsWith(p)) && session.role !== 'admin') {
    return redirectTo(req, '/dashboard');
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*', '/chart-of-accounts/:path*', '/journal-entries/:path*',
    '/invoices/:path*', '/bills/:path*', '/payments/:path*', '/banking/:path*',
    '/expenses/:path*', '/assets/:path*', '/reports/:path*', '/settings/:path*',
    '/smartlife/:path*', '/api/chart-of-accounts/:path*', '/api/journal-entries/:path*',
    '/api/invoices/:path*', '/api/bills/:path*', '/api/payments/:path*',
    '/api/banking/:path*', '/api/expenses/:path*', '/api/assets/:path*',
    '/api/dashboard/:path*', '/api/reports/:path*',
  ],
};
