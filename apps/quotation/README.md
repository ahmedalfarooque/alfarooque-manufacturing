# QuotePro — AL FAROOQUE Quotation & Cost Estimation System

Independent Next.js app (same pattern as `apps/cars` and `apps/projects`), deployed to **quotation.alfarooque.com**. Full design docs live in `docs/`.

## Run locally

```bash
# 1. One-time database setup (shared Supabase project):
#    Supabase Dashboard → SQL Editor → run supabase/apps-schema.sql (if not already)
#    then run supabase/quotation-schema.sql  (idempotent, safe to re-run)

# 2. Configure environment
cd apps/quotation
copy ..\projects\.env.local .env.local   # or create manually:
# SUPABASE_URL=...  SUPABASE_SERVICE_ROLE_KEY=...  JWT_SECRET=...
# RESEND_API_KEY=... (optional in dev — OTP codes print to the console)

# 3. Install & start
npm install
npm run dev        # http://localhost:3020
```

Login with the platform admin account (`arshad@alfarooque.com`) — identity is shared with the Cars/Projects apps via `platform_users`, but the session cookie (`af_quotation_session`) is independent.

## Structure

- `app/` — App Router pages: `login`, `(protected)/dashboard` + module routes, `api/*`
- `components/` — `Shell` (sidebar/topbar, EN/AR + RTL, dark mode), `GlassIcons`, `ComingSoon`
- `lib/` — `auth` `db` `email` `http` (cloned platform patterns), `i18n`, **`costing.js`** (pure costing engine — spec §9)
- `docs/` — Master Specification, Implementation Prompt, Conformance Addendum
- `../../supabase/quotation-schema.sql` — all `qt_*` tables + seed (entities WW/IAAE, labour roles, expense templates, material categories, settings)

## Deploy

Own Vercel project with root directory `apps/quotation`, domain `quotation.alfarooque.com` — follow `apps/DEPLOYMENT.md` (same steps as cars/projects). Env vars as above.
