import { redirect } from 'next/navigation';

/* The Dashboard/Vehicles/Maintenance/Alerts pages already hide every
   admin control (Add/Edit/Delete/Import/Mark-read) whenever the
   session role isn't "admin". A viewer session (minted only by the
   User tab on /login, never by the Admin password flow) landing on
   the exact same pages therefore already gets the correct read-only
   experience with zero duplicated UI. This route's only job is to be
   the "separate destination" the User login flow redirects to. */
export default function ViewRoot() {
  redirect('/dashboard');
}
