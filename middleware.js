import { rewrite, next } from '@vercel/functions';

/* Routing Middleware runs before filesystem/static matching, unlike
   vercel.json rewrites — which lose to an actual existing file at the
   same path (index.html always wins over a "/" rewrite otherwise).
   Scoped to "/" only; every other path bypasses this file entirely. */
export const config = {
  matcher: '/',
};

export default function middleware(request) {
  const host = request.headers.get('host') || '';
  if (host === 'mohammed.alfarooque.com') {
    return rewrite(new URL('/mohammed', request.url));
  }
  return next();
}
