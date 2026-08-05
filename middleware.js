import { rewrite, next } from '@vercel/functions';

/* Routing Middleware runs before filesystem/static matching, unlike
   vercel.json rewrites — which lose to an actual existing file at the
   same path (index.html always wins over a "/" rewrite otherwise).
   Scoped to "/" only; every other path bypasses this file entirely.
   /mohammed itself (the single source of truth, card/index.html) is
   resolved by the vercel.json rewrite / server.js route table — this
   file only handles the custom-domain root path. */
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
