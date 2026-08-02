# ERP Deployment Guide

Everything in this file can be prepared automatically; the actions themselves require your accounts (Vercel, Supabase, Squarespace DNS, Resend) and are listed as manual steps at the end of each section. No code changes are blocked on any of this — every app builds and runs today with local env vars.

## 1. Supabase Setup

### 1.1 Run schema migrations, in this exact order

In the Supabase Dashboard → **SQL Editor → New query**, paste and run each file completely before moving to the next:

1. `supabase/inv-schema-v01-initial.sql`
2. `supabase/inv-schema-v02-cross-app.sql`
3. `supabase/inv-schema-v03-issue-transfer-reservation.sql`
4. `supabase/inv-schema-v04-accounting-schema-fix.sql` — **critical**, corrects the Accounting schema to match the working API (see `ERP_ERRORS.md`)
5. `supabase/inv-schema-v05-purchasing-destination.sql`
6. `supabase/inv-schema-v06-crm-cross-links.sql`
7. `supabase/inv-schema-v07-app-permissions.sql`
8. `supabase/inv-schema-v08-sales-orders.sql` — Sales Order tracked entity (Projects app)
9. `supabase/inv-schema-v09-crm-settings.sql` — the `crm_settings` table CRM's own Settings page depends on (see `ERP_ERRORS.md`)
10. `supabase/inv-schema-v10-crm-schema-fix.sql` — **critical**, corrects `crm_contacts`/`crm_deals`/`crm_activities` to match the working CRM API (see `ERP_ERRORS.md`)
11. `supabase/inv-schema-v11-goods-receipt-items-fix.sql` — adds `location_id`/`po_item_id` to `inv_goods_receipt_items` (see `ERP_ERRORS.md`)

If `inv-schema-v01-initial.sql` has never been run, also confirm the pre-existing `platform_users`/`platform_otp_codes`/`platform_login_attempts` tables exist (they're defined in an earlier apps-schema file already in `supabase/` from before this ERP build-out — check with `select * from platform_users limit 1;` first).

### 1.2 Get your Project URL and service-role key

Dashboard → **Project Settings → API**:
- **Project URL** → this is `SUPABASE_URL` in every app's env
- **`service_role` `secret`** key → this is `SUPABASE_SERVICE_ROLE_KEY` in every app's env

⚠️ The service-role key bypasses all Row-Level Security. It must **only** ever be set as a server-side environment variable (Vercel Project Settings → Environment Variables), never in a `NEXT_PUBLIC_*` var or committed to git. Every app in this monorepo already follows this — `lib/db.js` in each app only runs server-side.

### 1.3 Create the first super-admin user

The super-admin email is hardcoded as `arshad@alfarooque.com` in every app's `lib/superAdmin.js` (always treated as `admin` regardless of stored role). Insert (or update) that row in `platform_users`:
```sql
insert into platform_users (email, full_name, role, is_active)
values ('arshad@alfarooque.com', 'Arshad', 'admin', true)
on conflict (email) do update set role = 'admin', is_active = true;
```
Every other user needs a `platform_users` row too (created via each app's own `/users` — or `/api/users` — API, or manually via SQL for the first batch).

### 1.4 Grant initial app access

The shared `app_permissions` table (v07) starts empty — non-admins see no apps in the Application Switcher until granted. For each non-admin user, either:
- Use the **Projects app's Users page** (`/users` → edit a user → "App Access" checkboxes) once the app is deployed, or
- Insert directly:
```sql
insert into app_permissions (user_id, app_id)
values ('<user-uuid>', 'inventory'), ('<user-uuid>', 'accounting');
```

## 2. Environment Variables

Every app has a `.env.example` at `apps/<app>/.env.example` listing exactly what that app's code reads (verified by grepping `process.env` usage, not guessed). Copy each to `.env.local` for local dev, and set the same keys in **Vercel → Project Settings → Environment Variables** for each of the 6 Vercel projects.

### Required in every app (identical values across all 6)
| Variable | Where it comes from |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key |
| `JWT_SECRET` | Generate once: `openssl rand -base64 48`. Must be **identical** in all 6 apps. |
| `SSO_JWT_SECRET` | Generate once (can equal `JWT_SECRET` or be separate): `openssl rand -base64 48`. Must be **identical** in all 6 apps. |
| `AF_COOKIE_DOMAIN` | `.alfarooque.com` in production (leading dot); leave unset on localhost |

### Sibling app URLs (identical set in every app)
```
NEXT_PUBLIC_QUOTATION_APP_URL=https://quotation.alfarooque.com
NEXT_PUBLIC_PROJECTS_APP_URL=https://projects.alfarooque.com
NEXT_PUBLIC_CARS_APP_URL=https://cars.alfarooque.com
NEXT_PUBLIC_INVENTORY_APP_URL=https://store.alfarooque.com
NEXT_PUBLIC_ACCOUNTING_APP_URL=https://accounting.alfarooque.com
NEXT_PUBLIC_CRM_APP_URL=https://crm.alfarooque.com
```
(Leave all six unset on localhost — the switcher falls back to dev ports 3030/3020/3010/3040/3050/3060 automatically.)

### App-specific extras
- **Inventory, Cars, Projects, Quotation**: `NEXT_PUBLIC_COMPANY_*` vars (PDF report branding), `RESEND_API_KEY`/`EMAIL_FROM`/`EMAIL_TO` (OTP + notification email — without `RESEND_API_KEY`, OTP codes just print to the server log, which is fine for testing but not production)
- **Quotation only**: `PROJECTS_APP_URL` (server-side, no `NEXT_PUBLIC_` prefix), `PUPPETEER_EXECUTABLE_PATH` (leave unset on Vercel — auto-detected), `CRON_SECRET` (any random string, protects the `/api/cron/expire` route)
- **Accounting, CRM**: no extras beyond the shared set above

## 3. Vercel Project Creation

Each app is deployed as its own Vercel project pointed at the same GitHub repo with a different **Root Directory**.

For each of the 6 apps, in the Vercel dashboard → **Add New → Project → Import** the `ahmedalfarooque/alfarooque-manufacturing` repo, then before deploying:

| App | Root Directory | Framework Preset | Suggested Project Name |
|-----|----------------|-------------------|------------------------|
| Quotation | `apps/quotation` | Next.js (auto-detected) | `af-quotation` |
| Projects | `apps/projects` | Next.js | `af-project-management` |
| Cars | `apps/cars` | Next.js | `af-cars-tracking` |
| Inventory | `apps/inventory` | Next.js | `af-inventory` |
| Accounting | `apps/accounting` | Next.js | `af-accounting` |
| CRM | `apps/crm` | Next.js | `af-crm` |

The root-level `vercel.json` (repo root) governs the static website only — it does not need editing for the ERP apps. Each ERP app's own `apps/<app>/vercel.json` (all now present, all `{"framework": "nextjs"}` plus Quotation's cron/puppeteer config) is picked up automatically once its Root Directory is set correctly.

After creating each project: paste in the env vars from Section 2, then trigger the first deploy (push to the branch, or click Deploy).

## 4. DNS Records (at your registrar — e.g. Squarespace Domains)

Once each Vercel project exists, Vercel's **Project Settings → Domains** tab gives you the exact CNAME target for that project (usually `cname.vercel-dns.com`, but always copy the exact value Vercel shows — it can be project-specific). Add these CNAME records at your DNS provider:

| Subdomain | Points to (Vercel project) |
|-----------|---------------------------|
| `quotation.alfarooque.com` | af-quotation |
| `projects.alfarooque.com` | af-project-management |
| `cars.alfarooque.com` | af-cars-tracking |
| `store.alfarooque.com` | af-inventory |
| `accounting.alfarooque.com` | af-accounting |
| `crm.alfarooque.com` | af-crm |

Root domain (`alfarooque.com`) and `www` continue pointing at the existing static website project — do not change those records.

If you want a single `admin.alfarooque.com` entry point instead of remembering 6 subdomains: point `admin.alfarooque.com` at whichever app you want as the default landing app (Inventory or Accounting are reasonable choices), since there is no separate "portal" app in this codebase — the Application Switcher inside each app **is** the cross-app navigation layer (see `ERP_NEXT_PHASE.md` / `ERP_REMAINING.md` if you want a dedicated landing app built later).

DNS propagation is typically 5 minutes to a few hours depending on your provider's TTL.

## 5. Email / SMTP (Resend)

Inventory, Cars, Projects, and Quotation send OTP codes and notification emails via [Resend](https://resend.com) (HTTP API, not raw SMTP).

1. Create a Resend account → **API Keys → Create API Key**.
2. Add the domain you'll send from (`alfarooque.com`) under **Domains** and add the DNS records Resend gives you (SPF/DKIM) at your registrar.
3. Set `RESEND_API_KEY` in the 4 apps' Vercel env vars.
4. Set `EMAIL_FROM` (e.g. `noreply@alfarooque.com`) and, where used, `EMAIL_TO` (an internal address that receives copies of purchase-request/low-stock alerts).

Without this, every app still works — OTP codes are printed to the Vercel function logs instead of emailed, which is fine for internal testing but not for real users who can't see server logs.

## 6. Post-Deploy Checklist

- [ ] All 11 SQL migrations run, in order (Section 1.1)
- [ ] Super-admin row exists in `platform_users` (Section 1.3)
- [ ] Env vars set identically across all 6 Vercel projects (Section 2)
- [ ] All 6 Vercel projects created and deployed (Section 3)
- [ ] DNS CNAMEs added for all 6 subdomains (Section 4)
- [ ] Resend configured, `RESEND_API_KEY` set in Inventory/Cars/Projects/Quotation (Section 5)
- [ ] Log in as the super-admin on one app, confirm the Application Switcher shows all 6 apps
- [ ] Grant `app_permissions` rows for at least one non-admin test user, confirm their switcher shows only the granted apps
- [ ] Run through `ERP_COMPLETED.md`'s feature list once against the live deployment
