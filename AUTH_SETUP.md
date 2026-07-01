# AL FAROOQUE — Authentication Setup (Supabase)

The auth **UI and code are fully built and working**. To make sign-in actually
work, you complete the steps below (they need your own Supabase account — that
part can't be done for you). Budget ~15 minutes. No secrets are committed.

---

## 1. Create the Supabase project
1. Go to **https://supabase.com** → sign in → **New project**.
2. Name it (e.g. `alfarooque`), pick a region near Saudi Arabia, set a DB password.
3. Wait ~2 min for it to provision.

## 2. Paste your public keys
1. Dashboard → **Project Settings → API**.
2. Copy **Project URL** and the **`anon` `public`** key.
3. Open **`js/auth/config.js`** and replace the two placeholders:
   ```js
   window.__AF_SUPABASE__ = {
     url:     'https://YOUR-PROJECT-REF.supabase.co',   // ← Project URL
     anonKey: 'eyJhbGci...'                              // ← anon public key
   };
   ```
   > These two values are **public by design** (safe in client code, protected
   > by Row-Level Security). Never put the `service_role` key here.

## 3. Create the database tables
1. Dashboard → **SQL Editor → New query**.
2. Paste the entire contents of **`supabase/schema.sql`** → **Run**.
   This creates `profiles`, `wishlist`, `addresses`, `carts`, `orders`, the
   roles enum (admin/manager/customer), Row-Level Security, the avatar storage
   bucket, and the trigger that auto-creates a profile on signup.

## 4. Set redirect URLs
Dashboard → **Authentication → URL Configuration**:
- **Site URL:** `https://alfarooque.com` (use `http://localhost:3000` while testing)
- **Redirect URLs** (add all you use):
  - `http://localhost:3000/pages/auth/callback.html`
  - `http://localhost:3000/pages/auth/reset-password.html`
  - `https://alfarooque.com/pages/auth/callback.html`
  - `https://alfarooque.com/pages/auth/reset-password.html`

## 5. Email verification & templates
- Email confirmation is **on by default** — users must verify before logging in.
- Dashboard → **Authentication → Email Templates**. Paste the branded HTML from
  `supabase/email-templates/`:
  - **Confirm signup** ← `confirm-signup.html`
  - **Reset Password** ← `reset-password.html`
- Supabase's built-in mailer is fine for testing. For production volume, add your
  own SMTP under **Project Settings → Auth → SMTP** (e.g. the same Resend/SMTP you
  use for the quote forms).

## 6. Google sign-in (the one social provider wired now)
1. **Google Cloud Console** → create OAuth consent screen + **OAuth client ID**
   (type: Web application).
2. Authorized redirect URI — copy it from Supabase: Dashboard →
   **Authentication → Providers → Google** shows the exact callback
   (`https://YOUR-REF.supabase.co/auth/v1/callback`). Paste that into Google.
3. Copy Google's **Client ID** + **Client Secret** into Supabase → Providers →
   **Google** → enable + save.
4. Done — the Google button now works. (Microsoft/Apple/Facebook buttons are
   shown as "coming soon"; enable them later the same way under Providers.)

## 7. Test
- Local: `npm run dev` → open `http://localhost:3000/products` → **Login**.
- Sign up → check inbox → verify → log in → avatar + dropdown appears.
- Try **Forgot password** → reset email → `reset-password.html` → new password.
- Production: the same keys are public, so they're already in the deployed
  `config.js`. Just make sure the production redirect URLs (step 4) are added.

---

## What's included
| Area | File(s) |
|------|---------|
| Public config | `js/auth/config.js` |
| Auth core (Supabase client + API) | `js/auth/auth.js` |
| Modal + nav avatar/dropdown UI | `js/auth/auth-ui.js`, `css/auth.css` |
| Account dashboard | `pages/account.html`, `js/auth/account.js`, `css/account.css` |
| OAuth / verification landing | `pages/auth/callback.html` |
| Password reset page | `pages/auth/reset-password.html` |
| Database schema + RLS + roles | `supabase/schema.sql` |
| Email templates | `supabase/email-templates/*.html` |

## Security notes
- Passwords are hashed by Supabase (bcrypt) — never stored or seen client-side.
- JWT sessions persist across pages; tokens auto-refresh; PKCE OAuth flow.
- Row-Level Security means each user can read/write only their own rows.
- Rate limiting, CSRF protection, and secure cookies are handled by Supabase Auth.
- The `anon` key is public and safe; the `service_role` key must never ship to the client.

## Admin / roles (future panel)
`profiles.role` is an enum: `admin` / `manager` / `customer` (default `customer`).
Promote a user: in SQL Editor →
`update public.profiles set role = 'admin' where id = '<user-uuid>';`
