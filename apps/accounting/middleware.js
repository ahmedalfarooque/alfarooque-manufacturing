import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { isSuperAdminEmail } from './lib/superAdmin';
import { sessionCanEnterApp } from '../shared/appAccess';

const APP_ID = 'accounting';

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
  if (session) return { session, viaSso: false };
  const ssoToken = req.cookies.get(SSO_COOKIE_NAME)?.value;
  const sso = ssoToken ? await verifySso(ssoToken) : null;
  return { session: sso, viaSso: !!sso };
}

const ADMIN_ONLY_PREFIXES = ['/settings', '/users'];
/* /api/dashboard and /api/reports are RE-ACTIVATED (product decision,
   2026-08-13): they now back a real local aggregation layer built on top
   of the synced SmartERP snapshot (erp_financial_source_records) plus
   AL FAROOQUE's own local records (pm_purchase_requests, erp_project_payments)
   — never fabricated data, never a SmartLife write. Everything still
   genuinely unbuilt (chart-of-accounts/journal-entries/invoices/bills/
   payments/banking/expenses/assets) stays retired until it has a real
   backend, so users are never shown a page that quietly does nothing. */
const LOCAL_FINANCIAL_APIS = [
  '/api/chart-of-accounts', '/api/journal-entries', '/api/invoices', '/api/bills',
  '/api/payments', '/api/banking', '/api/expenses', '/api/assets',
];
const LEGACY_FINANCIAL_PAGES = [
  '/chart-of-accounts', '/journal-entries', '/invoices', '/bills',
  '/payments', '/banking', '/expenses', '/assets',
];

function redirectTo(req, path) {
  return NextResponse.redirect(new URL(req.nextUrl.basePath + path, req.url));
}

/* Effective role must match lib/auth.js readSession (super-admin
   override) or the page gate and the API disagree — see apps/cars. */
function effectiveSession(session) {
  if (!session) return null;
  if (isSuperAdminEmail(session.email)) return { ...session, role: 'admin' };
  return session;
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const { session: rawSession, viaSso } = await readAnySession(req);
  const session = effectiveSession(rawSession);

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
      : '/smartlife/sales-invoices';
    return redirectTo(req, target);
  }

  /* Application access ("may this user enter accounting at all?"). Sessions
     minted since the app-access release carry an `apps` claim; a session
     without the claim is a legacy token — the app's own cookie is still
     honoured (its login already checked the grant), but a legacy SSO
     token from a sibling app is not. The API layer enforces the grant
     independently (shared moduleAuthorization). */
  const can = sessionCanEnterApp(session, APP_ID);
  if (can === false || (can === null && viaSso)) {
    return redirectTo(req, '/no-access');
  }

  /* Admin-only pages: a clear forbidden page, never a silent bounce. */
  if (ADMIN_ONLY_PREFIXES.some(p => pathname.startsWith(p)) && session.role !== 'admin') {
    return redirectTo(req, '/forbidden?from=' + encodeURIComponent(pathname));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/launch/:path*',
    '/dashboard/:path*', '/chart-of-accounts/:path*', '/journal-entries/:path*',
    '/invoices/:path*', '/bills/:path*', '/payments/:path*', '/banking/:path*',
    '/expenses/:path*', '/assets/:path*', '/reports/:path*', '/vat/:path*', '/settings/:path*', '/users/:path*',
    '/smartlife/:path*', '/api/chart-of-accounts/:path*', '/api/journal-entries/:path*',
    '/api/invoices/:path*', '/api/bills/:path*', '/api/payments/:path*',
    '/api/banking/:path*', '/api/expenses/:path*', '/api/assets/:path*',
    /* /api/dashboard and /api/reports are intentionally NOT matched here —
       same as /api/smartlife/*: auth is enforced inside each route via
       requireSession(), not by this middleware. */
  ],
};
