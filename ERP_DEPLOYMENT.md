# ERP Deployment Guide

Everything in this file can be prepared automatically; the actions themselves require your accounts (Vercel, Supabase, Squarespace DNS, Resend) and are listed as manual steps at the end of each section. No code changes are blocked on any of this — every app builds and runs today with local env vars.

## 1. Supabase Setup

### 1.1 Run schema migrations, in this exact order

In the Supabase Dashboard → **SQL Editor → New query**, paste and run each file completely before moving to the next:

1. `supabase/inv-schema-v01-initial.sql`
2. `supabase/inv-schema-v02-cross-app.sql`
3. `supabase/inv-schema-v03-issue-transfer-reservation.sql`
4. `supabase/inv-schema-v04-accounting-schema-fix-v2.sql` — **critical**, corrects the Accounting schema to match the working API (see `ERP_ERRORS.md`). Use **v2**, not the original `v04-accounting-schema-fix.sql` — that file fails with `ERROR 42710: constraint already exists` (two tables redeclared the same `created_by` FK both inline and as a named constraint); v2 fixes this with no schema/logic changes otherwise.
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

### 1.5 Post-migration verification checklist

Run each query below in the SQL Editor immediately after its migration to confirm it applied cleanly before moving to the next file.

| After migration | Verify with | Expected result |
|---|---|---|
| `apps-schema.sql` (pre-existing) | `select count(*) from platform_users;` | Succeeds (0 rows is fine — table just needs to exist) |
| `v01-initial` | `select count(*) from inv_products;` | Succeeds, 0 rows |
| `v02-cross-app` | `select count(*) from inv_stock, inv_warehouses;` | Succeeds |
| `v03-issue-transfer-reservation` | `select count(*) from inv_stock_reservations;` | Succeeds |
| `v04-accounting-schema-fix` | `select column_name from information_schema.columns where table_name='acc_invoices' order by 1;` | Column list matches `apps/accounting/lib` usage (no `otp_codes`-style mismatch) |
| `v05-purchasing-destination` | `select count(*) from acc_bills where destination_type is not null;` | Column exists, query succeeds |
| `v06-crm-cross-links` | `select linked_quotation_id, linked_project_id from crm_deals limit 1;` | Columns exist |
| `v07-app-permissions` | `select count(*) from app_permissions;` | Succeeds, 0 rows (starts empty — see 1.4) |
| `v08-sales-orders` | `select count(*) from sales_orders, sales_order_lines;` | Succeeds |
| `v09-crm-settings` | `select count(*) from crm_settings;` | Succeeds |
| `v10-crm-schema-fix` | `select contact_type, stage, activity_type from crm_contacts, crm_deals, crm_activities limit 0;` | Enum-backed CHECK columns exist with the new names |
| `v11-goods-receipt-items-fix` | `select location_id, po_item_id from inv_goods_receipt_items limit 0;` | Both columns exist |

If any query errors, stop and re-run that migration file before continuing — do not run later files against a partially-applied schema.

### 1.6 Storage bucket setup

Every file-upload code path in the 6 apps was grepped for `storage.from(...)` — exactly 4 buckets are referenced, all by apps already live (Quotation, Cars, Projects). Inventory, Accounting, and CRM have no file-upload code today, so they need no buckets.

| Bucket | Used by | Code path | Public? |
|---|---|---|---|
| `driver-documents` | Cars | `app/api/drivers/[id]/photo/route.js` | Yes — `getPublicUrl()` is used to render driver photos, so the bucket needs public read access |
| `maintenance-documents` | Cars | `app/api/maintenance-records/[id]/attachments/*` | Yes — same `getPublicUrl()` pattern |
| `project-documents` | Projects | `app/api/purchase-requests/[id]/attachments/*`, `app/api/daily-updates/[id]/attachments/*`, `app/api/projects/[id]/documents/*` | Yes — same pattern |
| `product-images` | Quotation | `app/api/catalogue/[id]/images/route.js` | Yes — same pattern |

Create each bucket in Supabase Dashboard → **Storage → New bucket**, checking "Public bucket" for all four (uploads/deletes still go through the service-role key server-side, so no separate storage RLS policy is required for writes).

### 1.7 RLS verification checklist

RLS is intentionally disabled project-wide — every `inv_*`/`acc_*`/`crm_*`/`sales_*`/`platform_*` table across all 11 migration files has zero `CREATE POLICY` / `ENABLE ROW LEVEL SECURITY` statements (confirmed by direct grep of the full migration chain). All access control is enforced in application code via the service-role key + JWT session checks, not Postgres RLS. After running the migrations, confirm this matches intent:
```sql
select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = true;
```
Expected result: **0 rows**. If any table shows `relrowsecurity = true`, RLS was enabled somewhere outside this migration chain (e.g. via the Supabase Dashboard's "Enable RLS" prompt) and will silently block every request made through the anon/publishable key path — the service-role key itself always bypasses RLS, so this only matters if any app ever switches off the service-role key.

### 1.8 Authentication flow verification checklist

- [ ] `platform_users` has the super-admin row (1.3) with `role='admin'`, `is_active=true`
- [ ] Login with `arshad@alfarooque.com` on each of the 6 apps independently succeeds (OTP prints to server logs until `RESEND_API_KEY` is set)
- [ ] `platform_otp_codes` gets a new row per login attempt with `purpose='login'`, `app` matching the app you logged into, and `consumed_at` set after successful verification
- [ ] The `af_sso_session` cookie is set on the parent domain (`.alfarooque.com` in production) after login, and logging into a second app without re-entering OTP works (SSO)
- [ ] Each app's own `af_<app>_session` cookie is also set and independent of the SSO cookie
- [ ] A non-admin test user with no `app_permissions` rows sees an empty Application Switcher; granting a row (1.4) makes that app appear without re-login

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

Each app is deployed as its own Vercel project pointed at the same GitHub repo with a different **Root Directory**. Build Command, Output Directory, and Install Command are all left at the Next.js framework preset default (`next build`, `.next`, `npm install`) — none of the 6 apps override these, so nothing needs to be typed in manually once "Next.js" is selected as the Framework Preset.

### 3.1 Already deployed — verify only, do not recreate

Confirmed live via the connected Vercel MCP (team `ahmed-1673s-projects`), all on Node 24.x, all latest deployment `READY`:

| Project | Root Directory | Framework | Bound production domain(s) |
|---|---|---|---|
| `alfarooque-manufacturing` (Main Website) | *(repo root)* | `nextjs` per the Vercel API¹ | `alfarooque.com`, `www.alfarooque.com` |
| `af-quotation` | `apps/quotation` | `nextjs` | `quotation.alfarooque.com` |
| `af-cars-tracking` | `apps/cars` | `nextjs` | `cars.alfarooque.com` |
| `af-project-management` | `apps/projects` | `nextjs` | `projects.alfarooque.com` |

¹ The repo's own root `vercel.json` sets `"framework": null` (correct — the root site is static HTML/CSS/JS, not Next.js), but the Vercel API reports this project's Framework Preset as `nextjs`. This mismatch was flagged in the prior audit and is unresolved — it's a Vercel *project setting*, not a repo file, so fixing it requires a Dashboard edit (Project Settings → General → Framework Preset → "Other"), which falls under "Vercel Dashboard interaction" and is not made here.

**Business Card**: your current-status note says it "already has an existing Vercel project" — this is consistent with what I can see, but with a caveat: incoming PR-comment webhooks from Vercel show a project named **`mohammed-card`** (ID `prj_ux1w8Og0dbkkQsSxINUn2gBCFM9Q`) deploying successfully under this same team ID on every push. However, `mcp__Vercel__get_project` on that exact ID returns **404 Not Found**, and it does not appear in `list_projects` for this team either. That means the connected Vercel MCP token cannot see or verify this project's configuration — it may be scoped more narrowly than the token behind the GitHub↔Vercel integration. **I cannot verify Business Card's Root Directory, env vars, or bound domain from here.** Please confirm in the Vercel Dashboard directly: Project Settings → General (Root Directory should be `card/`) and → Domains (expected `card.alfarooque.com` or similar, not yet documented anywhere in this repo).

### 3.2 Not yet created — prepared, not created

For each, in the Vercel dashboard → **Add New → Project → Import** the `ahmedalfarooque/alfarooque-manufacturing` repo:

| Field | Inventory | Accounting | CRM |
|---|---|---|---|
| Project Name | `af-inventory` | `af-accounting` | `af-crm` |
| Root Directory | `apps/inventory` | `apps/accounting` | `apps/crm` |
| Framework Preset | Next.js (auto-detected via `apps/inventory/vercel.json` → `{"framework":"nextjs"}`) | Next.js (`apps/accounting/vercel.json`) | Next.js (`apps/crm/vercel.json`) |
| Build Command | *(default)* `next build` | *(default)* `next build` | *(default)* `next build` |
| Output Directory | *(default)* `.next` | *(default)* `.next` | *(default)* `.next` |
| Install Command | *(default)* `npm install` | *(default)* `npm install` | *(default)* `npm install` |
| Node Version | 24.x (match the other 4 projects) | 24.x | 24.x |
| Environment Variables | Shared set (Section 2) + `NEXT_PUBLIC_COMPANY_*` + `RESEND_API_KEY`/`EMAIL_FROM`/`EMAIL_TO` (per `apps/inventory/.env.example`) | Shared set only (per `apps/accounting/.env.example` — no extras) | Shared set only (per `apps/crm/.env.example` — no extras) |
| Preview Domain (auto-assigned) | `af-inventory-*.vercel.app` | `af-accounting-*.vercel.app` | `af-crm-*.vercel.app` |
| Production Domain (to bind, Section 4) | `store.alfarooque.com` | `accounting.alfarooque.com` | `crm.alfarooque.com` |

After creating each project: paste in the env vars from Section 2, then trigger the first deploy (push to the branch, or click Deploy). These three are **not created** — creation itself is a Vercel Dashboard action and is left for you to perform.

## 4. DNS Records (at your registrar — e.g. Squarespace Domains)

Once each Vercel project exists, Vercel's **Project Settings → Domains** tab gives you the exact CNAME target for that project (usually `cname.vercel-dns.com`, but always copy the exact value Vercel shows — it can be project-specific).

### 4.1 Already configured — do not touch

Confirmed bound (via 3.1): `alfarooque.com` / `www` → Main Website, `quotation.alfarooque.com` → af-quotation, `cars.alfarooque.com` → af-cars-tracking, `projects.alfarooque.com` → af-project-management. Leave these records exactly as they are.

### 4.2 Remaining — needed once Section 3.2's projects are created

| Type | Host | Target | TTL | For project |
|---|---|---|---|---|
| CNAME | `store` | *(copy exact value from af-inventory → Project Settings → Domains)*, typically `cname.vercel-dns.com` | 3600 (or your provider's default — lower it temporarily if you want faster cutover verification) | af-inventory |
| CNAME | `accounting` | *(copy exact value from af-accounting → Project Settings → Domains)* | 3600 | af-accounting |
| CNAME | `crm` | *(copy exact value from af-crm → Project Settings → Domains)* | 3600 | af-crm |

Business Card's subdomain is not yet decided/documented anywhere in this repo — confirm the intended host (e.g. `card.alfarooque.com`) once you've verified the `mohammed-card` project's bound domain in the Dashboard (3.1).

**Verification steps** (per record, after adding):
1. `dig CNAME store.alfarooque.com` (or `accounting.` / `crm.`) — confirm it resolves to the Vercel target, not NXDOMAIN.
2. Visit `https://store.alfarooque.com` (etc.) in a browser — confirm it loads the correct app and not a Vercel "Domain not found" error.
3. In Vercel → that project → Domains, confirm the domain shows a green "Valid Configuration" checkmark, not "Invalid Configuration."

**Expected propagation**: 5 minutes to a few hours depending on the registrar's TTL and DNS caching upstream; Squarespace-managed DNS typically resolves within 15–30 minutes.

**Rollback plan**: if a new CNAME causes an outage or misconfiguration, delete just that one record at the registrar — this affects only that subdomain and cannot break `alfarooque.com`, `www`, or the 3 already-live ERP subdomains, since those are separate DNS records untouched by this change.

If you want a single `admin.alfarooque.com` entry point instead of remembering 6 subdomains: point `admin.alfarooque.com` at whichever app you want as the default landing app (Inventory or Accounting are reasonable choices), since there is no separate "portal" app in this codebase — the Application Switcher inside each app **is** the cross-app navigation layer (see `ERP_NEXT_PHASE.md` / `ERP_REMAINING.md` if you want a dedicated landing app built later).

## 5. Email / SMTP (Resend)

Inventory, Cars, Projects, and Quotation send OTP codes and notification emails via [Resend](https://resend.com) (HTTP API, not raw SMTP). Grepping every app's `lib/email.js`-equivalent confirms this set is exhaustive — Accounting and CRM have no email-sending code at all today.

1. **Domain verification**: create a Resend account → **Domains → Add Domain** → `alfarooque.com`.
2. **DNS requirements**: Resend will show 2–3 records to add at your registrar — typically an `MX` (for bounce handling), a `TXT` for SPF, and a `TXT`/`CNAME` pair per DKIM selector. Copy the exact values Resend displays; they are account-specific and cannot be guessed or pre-filled here.
3. **API key location**: **API Keys → Create API Key** (scope: "Sending access" is sufficient — no need for full account access). Set as `RESEND_API_KEY` in Vercel → Project Settings → Environment Variables for Inventory, Cars, Projects, and Quotation only.
4. **Environment variables**: `RESEND_API_KEY` (all 4 apps), `EMAIL_FROM` (e.g. `noreply@alfarooque.com`, all 4 apps), `EMAIL_TO` (internal address for purchase-request/low-stock alert copies — Inventory and Projects only, per their `.env.example`).
5. **Test procedure**: after setting the key and redeploying, trigger a real OTP login on one app and confirm the email arrives (not just the console log fallback); trigger one low-stock or purchase-request notification in Inventory/Projects and confirm delivery.
6. **Rollback procedure**: unset `RESEND_API_KEY` (or revoke the key in Resend) to instantly revert to the console-log OTP fallback — no code change needed, no other app or table is affected, since the email path is a no-op without the key.

Without this, every app still works — OTP codes are printed to the Vercel function logs instead of emailed, which is fine for internal testing but not for real users who can't see server logs.

## 6. Production Validation Checklist

Run through this once, in full, against the live deployment before considering it production-ready. Grouped by area; check off each independently.

**Authentication & SSO**
- [ ] OTP login succeeds on all 6 ERP apps + email delivery confirmed (Resend, Section 5)
- [ ] `af_sso_session` set on `.alfarooque.com`; logging into a second app doesn't require a fresh OTP (Section 1.8)
- [ ] Each app's independent `af_<app>_session` cookie set correctly
- [ ] Super-admin override (`arshad@alfarooque.com`) works on all 6 apps regardless of stored `role`

**Application Switcher / Permissions**
- [ ] Admin/super-admin sees all 6 apps in the switcher on every app
- [ ] Non-admin with no `app_permissions` rows sees zero apps
- [ ] Granting a row via Projects → Users → App Access immediately reflects in that user's switcher

**Per-app smoke test**
- [ ] Inventory — create item, Goods Receipt, Goods Issue, Transfer, Reservation; confirm `qty_on_hand` updates correctly on each
- [ ] Accounting — Journal Entry (balanced lines), Invoice/Bill with line items, a Bill routed to each Purchasing destination (Warehouse/Project/Asset)
- [ ] CRM — create Contact, Deal (each stage), Activity; confirm `crm_settings` Settings page loads
- [ ] Cars — Vehicle, Driver (with photo upload), Maintenance record (with attachment)
- [ ] Projects — Project, Purchase Request (with attachment), Daily Update (with attachment), Sales Order full pipeline (Reserve → Deliver → Invoice → Mark Paid)
- [ ] Quotation — Quotation create → PDF export → catalogue item with image upload
- [ ] Business Card — loads at its production domain, all links/assets resolve
- [ ] Main Website — both EN and AR page pairs load, theme + language switchers persist across reloads

**Uploads & Storage**
- [ ] All 4 buckets created and public (Section 1.6); uploaded files render via their public URL, not a 403/404

**Emails**
- [ ] OTP delivery confirmed live (not console fallback) — Section 5
- [ ] Low-stock / purchase-request notification emails confirmed live

**ZATCA**
- [ ] Accounting invoice PDF renders a scannable Base64 TLV QR code with correct seller name, VAT number, timestamp, invoice total, and VAT total

**Reports**
- [ ] Inventory: Stock Valuation, Movements, Low Stock, Purchasing reports generate and export to PDF
- [ ] Accounting: Income Statement, Balance Sheet, Cash Flow, VAT, Inventory Valuation, Project Costing reports generate correctly

**Database**
- [ ] All 11 migrations applied and verified (Section 1.5)
- [ ] RLS confirmed disabled everywhere as intended (Section 1.7)
- [ ] No orphaned rows from cross-app writes (e.g. every `sales_orders.invoice_id` resolves to a real `acc_invoices` row)

**Security**
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set only as a server-side env var in every project, never `NEXT_PUBLIC_*`
- [ ] `JWT_SECRET` / `SSO_JWT_SECRET` identical across all 6 apps
- [ ] `AF_COOKIE_DOMAIN` set correctly in production (leading dot) so the SSO cookie doesn't leak to unrelated subdomains

**Performance**
- [ ] Cold-start load time on each app's production domain is reasonable (Vercel serverless — first hit after idle may be slower; note but don't block on this)
- [ ] Dashboard charts (recharts, lazy-loaded) render without a layout-shift flash

## 7. Go-Live Checklist

**Pre-deployment**
- [ ] Sections 1–6 above fully complete and checked off
- [ ] This PR (#1) reviewed and approved
- [ ] A rollback point identified: current `main` branch SHA, noted before merge

**Deployment**
- [ ] Merge PR #1 into `main` (requires your explicit GitHub merge approval — not done autonomously)
- [ ] Confirm all Vercel projects redeploy from `main` (not the feature branch) and go `READY`
- [ ] Flip DNS for the 3 remaining subdomains (Section 4.2) only after their Vercel projects are confirmed `READY`

**Post-deployment**
- [ ] Run the full Production Validation Checklist (Section 6) again against the live `main`-branch deployment
- [ ] Confirm no Vercel function errors in the first hour (Vercel → Project → Logs)
- [ ] Confirm Supabase connection pool isn't saturated (Supabase → Database → Connection Pooling stats)

**Rollback**
- [ ] Vercel: each project can be instantly reverted to the previous deployment via **Deployments → (previous) → Promote to Production** — no rebuild needed
- [ ] DNS: revert only the specific record added, per-subdomain (Section 4.2's rollback plan) — does not affect other subdomains
- [ ] Database: no destructive migrations are part of this rollout (all 11 files are additive or safe `DROP`+recreate on tables with zero production rows today) — no DB rollback script is needed for this release

**Monitoring**
- [ ] Watch Vercel deployment status for all 8 projects for the first 24 hours
- [ ] Watch Supabase logs for query errors or connection exhaustion
- [ ] Watch Resend delivery logs for bounces/failures

**Success criteria**
- [ ] All 8 production domains resolve and serve the correct app
- [ ] Super-admin can log into and use every app end-to-end
- [ ] At least one full cross-app workflow (Quotation → Sales Order → Inventory reservation → Accounting invoice) completes without manual DB intervention
- [ ] Zero unhandled 500s in the first 24 hours of Vercel function logs
