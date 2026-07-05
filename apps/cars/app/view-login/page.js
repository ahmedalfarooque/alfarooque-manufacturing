import { redirect } from 'next/navigation';

/* The "User" (view-only, no password) login is now the default tab on
   the single /login page, so this route just lands there — no query
   param needed since User is already what shows up by default. Kept
   only so old links/bookmarks to /view-login keep working. */
export default function ViewLoginRedirect() {
  redirect('/login');
}
