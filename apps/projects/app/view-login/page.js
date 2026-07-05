import { redirect } from 'next/navigation';

/* The View Only login is now a tab on the single /login page (per
   request: one page, a switch that changes only the credentials box),
   not a separate page. This route still exists so existing links and
   the middleware's redirect target for unauthenticated /view/* visits
   keep working — it just lands on /login with that tab pre-selected. */
export default function ViewLoginRedirect() {
  redirect('/login?mode=view');
}
