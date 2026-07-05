# Deploying the Cars Tracking & Project Management apps

Two fully independent Next.js apps live here — `apps/cars` and `apps/projects`.
Neither touches the main static site's code, build, or `vercel.json`. Each is
deployed as its **own Vercel project**, then the main site's `vercel.json` gets
two additive rewrite rules so `alfarooque.com/cars` and `alfarooque.com/projects`
transparently proxy to them. The main site never rebuilds, never redeploys its
own code, and is never at risk from a bug in either app.

## 0. One-time database setup (do this first)

Both apps share the **same Supabase project** as the main site, using
brand-new, fully isolated tables — nothing here touches `products`, `orders`,
`admin_users`, or any existing data.

1. Supabase Dashboard → **SQL Editor → New query**.
2. Paste the entire contents of **`supabase/apps-schema.sql`** → **Run**.
3. This creates `platform_users` / `platform_otp_codes` / `platform_sessions`
   (shared login for both apps) plus `cars`, `car_maintenance`,
   `car_maintenance_log`, `car_alerts`, `car_trips`, `pm_projects`,
   `pm_project_logs`, `pm_project_documents` — and seeds one admin account:
   `arshad@alfarooque.com` / `123Abc45@@@` (change the password after first
   login — `must_change_password` is already `true`).
4. To add `ahmed@alfarooque.com` as a second admin, either re-run a copy of
   the seed `insert` at the bottom of `apps-schema.sql` with his email/password,
   or promote/insert directly:
   ```sql
   insert into public.platform_users (email, password_hash, full_name, role)
   values ('ahmed@alfarooque.com', crypt('CHOOSE_A_PASSWORD', gen_salt('bf', 12)), 'Ahmed', 'admin')
   on conflict (email) do nothing;
   ```

## 1. Deploy each app as its own Vercel project

Repeat for `apps/cars` and `apps/projects`:

```bash
cd apps/cars              # or apps/projects
npx vercel link           # first time: "Set up a new project?" -> yes
                           # project name suggestion: af-cars-tracking / af-project-management
npx vercel env add SUPABASE_URL production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel env add JWT_SECRET production        # generate with: openssl rand -hex 32
npx vercel env add RESEND_API_KEY production     # optional — omit to use mock-OTP console logging
npx vercel env add EMAIL_FROM production
npx vercel env add EMAIL_TO production
npx vercel --prod
```

Use a **different `JWT_SECRET`** for each app (don't reuse the value between
`apps/cars` and `apps/projects`, and don't reuse anything from the main site).
Repeat the same six `env add` commands and `vercel --prod` inside `apps/projects`.

Each command above prints a production URL like:
`https://af-cars-tracking-xxxx.vercel.app`. Note both URLs — you need them
for step 2.

## 2. Proxy `/cars` and `/projects` from the main site (do this last)

This is the only change made to the existing, live site — two additive
`rewrites` entries in the **root** `vercel.json` (the one at the repo root,
not inside `apps/*`). It does not touch any existing route, page, or asset.

```jsonc
// root vercel.json — add inside the existing "rewrites" array
{ "source": "/cars",       "destination": "https://af-cars-tracking-xxxx.vercel.app/cars" },
{ "source": "/cars/:path*", "destination": "https://af-cars-tracking-xxxx.vercel.app/cars/:path*" },
{ "source": "/projects",       "destination": "https://af-project-management-xxxx.vercel.app/projects" },
{ "source": "/projects/:path*", "destination": "https://af-project-management-xxxx.vercel.app/projects/:path*" }
```

Replace the `xxxx` URLs with the real production URLs from step 1, then
`git commit` + push (or `npx vercel --prod` from the repo root) to publish the
change to the live domain. This step was intentionally **not** applied
automatically — it's the one change that touches the live site's routing, so
it's done last, deliberately, once both apps are confirmed working on their
own Vercel URLs.

## 3. Verify

- `https://af-cars-tracking-xxxx.vercel.app/cars/login` — sign in with the
  seed admin, confirm the OTP email arrives (or check the Vercel function
  logs for the `[email:MOCK] ... code: 123456` line if `RESEND_API_KEY`
  wasn't set), then confirm the dashboard and vehicles table load.
- Same for the Projects app's own URL.
- Only after both are confirmed working standalone, do step 2 and check
  `alfarooque.com/cars` and `alfarooque.com/projects`.

## Local development

```bash
cd apps/cars      && cp .env.example .env.local   # fill in the values, then:
npm install && npm run dev     # http://localhost:3010/cars

cd apps/projects  && cp .env.example .env.local
npm install && npm run dev     # http://localhost:3020/projects
```

If `RESEND_API_KEY` is left blank, OTP codes are logged to the terminal
instead of emailed (`[email:MOCK] ... code: 123456`) — useful for local
testing without touching the email provider.

## What's built vs. what's future scope

**Built and working**: login + OTP (JWT session, httpOnly cookie) + RBAC
(admin/viewer), dashboards with the requested widgets/charts, the
vehicles/projects list with search/filter/sort/pagination, admin
add/edit/delete, Excel export (both apps), PDF export (both apps), Excel
**import** for vehicles (auto-maps English headers or the real AL FAROOQUE
Arabic fleet-sheet headers, skips duplicates by plate number), maintenance
schedule tracking with live-computed due/overdue status, and an alerts list.

**Not built (flagged honestly rather than faked)**: live GPS/WebSocket
position streaming (the brief's "Running/Stopped" status is stored and
editable, not fed by a real GPS device — there is no GPS hardware in scope
here), a fuel-log table/widget (the dashboard shows "SAR 0 — not yet
tracked" rather than inventing numbers), document upload UI for projects
(the `pm_project_documents` table and Supabase Storage convention are ready,
the upload screen isn't wired up yet), and a dedicated Reports page for
either app.
