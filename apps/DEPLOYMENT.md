# Deploying the Cars Tracking & Project Management apps

Two fully independent Next.js apps live here — `apps/cars` and `apps/projects`.
Neither touches the main static site's code, build, or `vercel.json`. Each is
deployed as its **own Vercel project**. The main site never rebuilds, never
redeploys its own code, and is never at risk from a bug in either app.

- **`apps/cars`** → its own subdomain, **`cars.alfarooque.com`**.
- **`apps/projects`** → its own subdomain, **`projects.alfarooque.com`**.

Both are pointed directly at their Vercel project (no basePath, no
`vercel.json` rewrite needed for either — see §2 below). The main site's
`vercel.json` is untouched.

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

## 2. Point each subdomain at its app

Neither `apps/cars` nor `apps/projects` has a basePath — each is built to
live at the root of whatever domain serves it. Do this in the Vercel
dashboard (or CLI) per app, not in code:

1. Open the app's Vercel project (`af-cars-tracking` or
   `af-project-management`) → **Settings → Domains**.
2. Add its subdomain (`cars.alfarooque.com` or `projects.alfarooque.com`) as
   a **Production Domain**. Or via CLI: `npx vercel domains add <subdomain>`
   from inside the app directory once it's linked.
3. At your DNS provider, add an **A record**: host = the subdomain prefix
   (`cars` or `projects`), value = `76.76.21.21` (Vercel's anycast IP —
   confirm the exact value Vercel shows you when you add the domain; it can
   change). Vercel auto-provisions the SSL certificate once DNS resolves,
   usually within a few minutes.
4. No `vercel.json` rewrite is needed or wanted for either app — a rewrite
   would still be path-based, which is exactly what the subdomain move
   avoids. DNS + the Vercel domain binding is the entire mechanism.

## 3. Verify

- `https://cars.alfarooque.com/login` and `https://projects.alfarooque.com/login`
  — sign in with the seed admin on each, confirm the OTP email arrives (or
  check the Vercel function logs for the `[email:MOCK] ... code: 123456`
  line if `RESEND_API_KEY` wasn't set), then confirm each dashboard loads.
- Each subdomain goes live independently the moment its DNS record
  propagates and Vercel issues the certificate — there's no main-site step
  for either, and no dependency between the two apps' rollouts.

## Local development

```bash
cd apps/cars      && cp .env.example .env.local   # fill in the values, then:
npm install && npm run dev     # http://localhost:3010 (root paths — no /cars prefix)

cd apps/projects  && cp .env.example .env.local
npm install && npm run dev     # http://localhost:3020 (root paths — no /projects prefix)
```

`server.js` at the repo root auto-starts both dev servers (and also proxies
`localhost:3000/cars/*` → `localhost:3010/*` and `localhost:3000/projects/*`
→ `localhost:3020/*`, stripping the prefix) purely as a local convenience,
since there's no real subdomain to hit on a dev machine. In production there
is no such proxy — each subdomain reaches its app directly.

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
