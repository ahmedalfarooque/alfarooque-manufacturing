/* Centralized list of admin account emails, used ONLY as a client-side
   fast-path signal (skip the normal customer flow and route to the real
   admin login/OTP endpoint instead). This is never itself an authorization
   decision — the actual password check always happens server-side against
   public.admin_users (bcrypt). Adding a new admin account means adding a
   row to admin_users AND this list; nothing else in the customer-facing
   auth flow needs to change. */
export const ADMIN_ACCOUNT_EMAILS = [
  'arshad@alfarooque.com',
  'ahmed@alfarooque.com',
];

export function isAdminAccountEmail(email) {
  return ADMIN_ACCOUNT_EMAILS.includes(String(email || '').toLowerCase());
}
