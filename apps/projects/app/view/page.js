import { redirect } from 'next/navigation';

/* The Dashboard/Projects/Customers pages already hide every admin
   control (Add/Edit/Delete) whenever the session role isn't "admin" —
   see the isAdmin checks in each page. A viewer session (minted only
   by /view-login, never by the password login) landing on the exact
   same pages therefore already gets the correct read-only experience
   with zero duplicated UI. This route's only job is to be the
   "separate destination" the view-login flow redirects to. */
export default function ViewRoot() {
  redirect('/dashboard');
}
