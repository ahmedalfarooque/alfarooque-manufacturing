# ERP Build Errors and Fixes

This file records every concrete bug found and fixed this session, discovered by verifying source code against itself and against the actual database schema — not by trusting prior documentation.

## Critical: Accounting schema/API mismatch (pervasive)

**Found by**: reading every `apps/accounting/app/api/**/route.js` file and comparing its exact column names/enum values against the actual `CREATE TABLE` statements in `supabase/inv-schema-v02-cross-app.sql`.

**Root cause**: the SQL schema and the Next.js API routes were written independently and never reconciled. Concretely:

| Table | Schema had | Code needed |
|-------|-----------|-------------|
| `acc_chart_of_accounts` | `code`, lowercase `account_type` | `account_code`, Capitalized `account_type` |
| `acc_journal_entries` | `entry_number`, lowercase `status` | `journal_number`, Capitalized `status` incl. `'Voided'` |
| `acc_invoices` | lowercase/incomplete `status` set | `'Draft','Sent','Paid','Overdue','Cancelled','Partially Paid'` |
| `acc_bills` | `supplier_name`, status set missing `'Unpaid'` | `vendor_name`, full capitalized status set |
| `acc_payments` | `payment_type` in `('received','made')`, no `party_name`/`invoice_id`/`bill_id` (those lived in a separate `acc_payment_allocations` table) | `payment_type` in `('receipt','payment')` with direct `party_name`/`invoice_id`/`bill_id` columns |
| `acc_bank_accounts` | `opening_balance` | `current_balance` |
| `acc_bank_transactions` | `txn_date`/`txn_type` | `transaction_date`/`transaction_type` |
| `acc_assets` | `useful_life_yrs`, `accumulated_dep`, `book_value`, status missing `'Under Maintenance'` | `useful_life_years`, `accumulated_depreciation`, `current_book_value`, full status set |
| `acc_settings` | **did not exist at all** | Settings page GET/PATCH depend on it |
| `acc_expenses` | **did not exist** — schema only had an `acc_expense_claims`/`acc_expense_lines` claims model with no submission UI ever built for it | flat table the API/UI actually use |

**Impact if left unfixed**: every write to almost every accounting table would have thrown a Postgres error (unknown column) or a CHECK constraint violation (wrong-case status value) the moment the schema was actually deployed to Supabase.

**Fix**: `supabase/inv-schema-v04-accounting-schema-fix.sql` — drops and recreates every mismatched table to match the working API/UI code exactly (safe because zero rows exist in Supabase yet). The application code was treated as the source of truth per this session's directive, since dozens of built and visually-verified UI pages already depend on its exact field names.

**Also fixed**: `dashboard/route.js` queried the unused `acc_expense_claims` model for month expenses while every other expense route (`expenses/route.js`, `expenses/[id]/route.js`, `reports/route.js`) used the flat `acc_expenses` table — an internal inconsistency independent of the schema mismatch. Now consistent.

## Inventory: `inv_stock_movements` missing columns

**Found by**: reading `goods-receipts/route.js`, which inserts `reference_type`/`reference_id` into `inv_stock_movements` — columns that were never defined in `inv-schema-v01-initial.sql`.

**Impact**: every Goods Receipt POST (a core, previously "complete" Phase 1 feature) would throw a Postgres "column does not exist" error against a real database.

**Fix**: `ALTER TABLE inv_stock_movements ADD COLUMN IF NOT EXISTS reference_type/reference_id` in `supabase/inv-schema-v03-issue-transfer-reservation.sql`.

## Inventory: denormalized quantity never synced

**Found by**: reading `inv_products`/`inv_materials` schema (has a `qty_on_hand` column described as "denormalized... updated by triggers / API") and then reading every stock-mutating route — none of them ever wrote to it, and no database trigger exists either.

**Impact**: the Inventory app's own Products/Materials list pages, plus the cross-app `inventory-search` endpoints in Quotation/Projects/Cars, would always show 0 on-hand quantity regardless of actual stock.

**Fix**: `apps/inventory/lib/stockSync.js` recomputes the true total from `inv_stock` and writes it back; called after every mutation (adjustments, receipts, issues, transfers, reservation fulfillment).

## Shared platform: SSO cookie clearing gap

**Found by**: comparing `APP_COOKIE_NAMES` in `lib/sso.js` across all 6 apps — Accounting and CRM (built later) had the full 6-name list; Quotation, Projects, Cars, Inventory (built earlier, never updated) only had 4.

**Impact**: an admin's "logout everywhere" flow would leave `af_accounting_session`/`af_crm_session` cookies live.

**Fix**: all 4 files updated to the full list.

## Shared platform: `appLinks.js` incomplete app list

**Found by**: same comparison — the same 4 apps' `APPS` array only listed `quotation/projects/cars/inventory`, omitting `accounting`/`crm` entirely.

**Impact**: an admin using the App Switcher from Quotation/Projects/Cars/Inventory could never navigate to Accounting or CRM (the buttons for those apps didn't exist), even before the permission-aware switcher change in this session.

**Fix**: all 4 files replaced with the complete 6-app version already used in Accounting/CRM.

## Shared platform: Cars missing super-admin override

**Found by**: `apps/cars/lib/auth.js` had no `superAdmin.js` import or `isSuperAdminEmail` check at all, unlike every other app.

**Impact**: `arshad@alfarooque.com` was not automatically granted admin rights in the Cars app the way it is everywhere else.

**Fix**: added `apps/cars/lib/superAdmin.js` (mirrored from the other apps) and wired it into `readSession()`.

## CRM: `AppSwitcherButtons.js` importing a hook that doesn't exist (found in this session's final build-verification pass)

**Found by**: running `npx next build` in `apps/crm` as part of the final build-verification sweep — the build succeeded but logged `Attempted import error: 'useLanguage' is not exported from '@/lib/i18n'`.

**Root cause**: CRM's `lib/i18n.js` is a smaller, standalone implementation (only exports `LanguageProvider`/`useLang`) rather than the fuller `useLanguage`/`trEnum` module the other 5 apps share. `AppSwitcherButtons.js` was copied over verbatim from an app that does export `useLanguage`, so the import silently resolved to `undefined`.

**Impact**: calling `useLanguage()` inside the component would throw a runtime `TypeError` the first time the Application Switcher rendered in CRM — i.e. for every logged-in user.

**Fix**: changed the import to `useLang` and destructured `{ lang }` from it (the only field the component uses). Rebuilt CRM — the warning is gone and the build is fully clean.

## Critical: Accounting + CRM login queried a table that never existed

**Found by**: the production-readiness audit's cross-cutting schema-vs-code sweep — grepping every `create table` across all 8 `supabase/inv-schema-v0*.sql` files against every `.from('<table>')` call in all 6 apps.

**Root cause**: `apps/accounting/app/api/auth/route.js` and `apps/crm/app/api/auth/route.js` both queried `.from('otp_codes')` for the OTP login step — a table name that exists in no migration file at all. The other 4 apps correctly use `platform_otp_codes` (defined in the pre-ERP `supabase/apps-schema.sql`), which is keyed by `user_id` + `attempt_count` + `consumed_at`, not the `email` + `attempts` + delete-on-use shape Accounting/CRM's code assumed.

**Impact**: every login attempt on Accounting and CRM would throw a Postgres "relation does not exist" error at the OTP-issue step — **both apps were completely unusable**, including for the super-admin account.

**Fix**: rewrote both routes' login/verify-otp/resend-otp handlers to use `platform_otp_codes` with its real columns (`user_id`, `purpose: 'login'`, `attempt_count`, `consumed_at`), matching the pattern already proven in `apps/cars/app/api/auth/route.js`. No schema change needed — `platform_otp_codes` already existed and was correct; only the two apps' code was wrong.

## Critical: CRM Settings queried a table that never existed

**Found by**: same audit sweep — `apps/crm/app/api/settings/route.js` reads/writes `.from('crm_settings')`, defined in no migration file.

**Impact**: the CRM Settings page would 404/500 on every load against a real database.

**Fix**: `supabase/inv-schema-v09-crm-settings.sql` adds the table with exactly the columns the route already reads/writes (`company_name`, `default_currency`, `deal_stages`, `activity_types`, `contact_sources`, `win_probability_threshold`), same single-row pattern as `acc_settings`.

## Critical: CRM contacts/deals/activities schema/API mismatch

**Found by**: the audit's per-app CRM check, comparing every `apps/crm/app/api/{contacts,deals,activities}/**` route against `supabase/inv-schema-v02-cross-app.sql`'s `crm_contacts`/`crm_deals`/`crm_activities` definitions — the same class of drift already found and fixed once for Accounting.

**Root cause**: same as the Accounting fix — schema and API were written independently.

| Table | Schema had | Code needed |
|-------|-----------|-------------|
| `crm_contacts` | `first_name`/`last_name`, `is_customer`/`is_active` booleans, no `contact_type`/`status`/`tags` | single `name` field, `contact_type` enum (`Lead/Prospect/Customer/Partner/Supplier`), `status`, `tags` |
| `crm_deals` | `stage_id` (FK to `crm_pipeline_stages`, never queried by any route), `close_date`, `notes`, lowercase `status` set | plain `stage` text column, `expected_close_date`, `description`, Capitalized `status` set (`Open/Won/Lost/On Hold`) |
| `crm_activities` | `due_date` (timestamptz), `duration_min`, lowercase `activity_type`/`status` sets (no `'demo'`) | `activity_date` (date), `duration_minutes`, Capitalized sets including `'Demo'` |

**Impact**: every contact/deal/activity create or update would either throw an "unknown column" error or violate a CHECK constraint (e.g. `'Demo'` activity type, `'Open'` deal status) the moment the schema was deployed to a real database — Contacts, Deals, and Activities (three of CRM's four core modules) would be entirely non-functional.

**Fix**: `supabase/inv-schema-v10-crm-schema-fix.sql` — drops and recreates all three tables to match the working API/UI code exactly (safe because zero rows exist in Supabase yet), folding in the `linked_quotation_id`/`linked_project_id` columns `inv-schema-v06-crm-cross-links.sql` added by `ALTER TABLE` (a recreate would otherwise silently drop them — the new file defines them inline instead).

## Inventory: Goods Receipt PO-linked path calls a nonexistent client method

**Found by**: the audit's Inventory workflow check — reading `apps/inventory/app/api/goods-receipts/route.js` line by line against the Supabase JS client's actual API surface.

**Root cause**: the PO-linked receiving branch writes a `po_item_id` column that doesn't exist on `inv_goods_receipt_items`, and calls `sb.raw(...)` — `raw()` is not a method the `@supabase/supabase-js` client exposes (it's a Knex/raw-SQL-builder pattern that doesn't apply here).

**Impact**: any Goods Receipt created against a Purchase Order (rather than a standalone receipt) would throw immediately.

**Fix**: removed the `po_item_id` write and replaced `sb.raw(...)` with a plain read-then-update (fetch the current value, compute the new value in JS, write it back) — the same non-raw pattern every other stock-mutating route in this app already uses.

## Inventory: Goods Receipt deletion never reverses stock

**Found by**: same check — `apps/inventory/app/api/goods-receipts/[id]/route.js` DELETE removes the receipt/items rows but never reverses the `qty_on_hand`/`avg_cost` increase or writes a reversing movement.

**Impact**: deleting a Goods Receipt (the route is live even though no UI button currently calls it) would permanently inflate on-hand stock with no way to correct it through the app.

**Fix**: DELETE now reverses the exact stock effect the receipt originally applied (decrements `qty_on_hand`, recomputes `avg_cost` from the remaining movements) and writes a reversing `inv_stock_movements` row, then calls the same `syncItemQty` every other mutation uses.

## Projects: Sales Order reservation is not atomic

**Found by**: the audit's Sales Order workflow check — `apps/projects/app/api/sales-orders/[id]/route.js`'s `reserveLines` loops lines and throws mid-loop on insufficient stock, but earlier lines in the same call had already reserved stock; retrying re-ran the loop over all lines with no guard against ones already reserved.

**Impact**: retrying a failed "Reserve Stock" action would double-reserve the lines that succeeded on the first attempt — decrementing available stock twice and creating duplicate `inv_stock_reservations` rows for the same order.

**Fix**: `reserveLines` now skips any line that already has a `reservation_id` set (from a prior partial attempt) instead of re-reserving it.

## Projects: Sales Order cancel has no status guard

**Found by**: same check — `cancel` had no status guard at all, but the reservation-release logic only ran `if (so.status === 'Reserved')`; the UI showed Cancel for `Delivered`/`Invoiced` orders too.

**Impact**: cancelling a `Delivered` order left the already-issued stock deduction permanently un-reversed (inventory gone, order shown Cancelled); cancelling an `Invoiced` order left the linked `acc_invoices` row untouched (still `Draft`/whatever it was, no indication it belongs to a cancelled order).

**Fix**: `cancel` on a `Delivered` order now re-adds the issued quantity back to `inv_stock.qty_on_hand` and writes a reversing movement; `cancel` on an `Invoiced` order sets the linked invoice's status to `Cancelled` (skipped if it's already `Paid`, since payment already happened).

## Accounting + CRM: missing `public/` folder

**Found by**: the audit's Accounting check, extended to CRM — neither app ships a `public/` directory, unlike the other 4, but both hardcode `src="/logo.png"` (`Shell.js`, login page, `layout.js` favicon) and Accounting's `Shell.js` additionally renders 4 `<GlassIcon>` components that fetch `/glass-icons.svg`.

**Impact**: broken logo image (both apps) plus every nav/topbar icon rendering as an empty slot in Accounting specifically — CRM's own `Shell.js` uses plain emoji for its nav icons and never references `<GlassIcon>`, so CRM's icon rendering was unaffected; only its logo was broken, and its `components/GlassIcons.js` was simply unused dead code (see Known Limitations) rather than a rendering bug.

**Fix**: added `apps/accounting/public/` and `apps/crm/public/` with `logo.png` and `glass-icons.svg` copied from a sibling app (identical brand assets across all 6 apps), and mounted the previously-unmounted `GlassIconsLoader` in CRM's `layout.js` for consistency with the other 5 apps (harmless even though nothing in CRM currently renders a `<GlassIcon>`).

## Projects: `/sales-orders` unguarded by middleware

**Found by**: the audit's middleware check — `middleware.js`'s `matcher` and `ADMIN_ONLY_PREFIXES` arrays were never updated when the Sales Orders feature was added this session, and the list API used plain `requireSession` with no `adminOnly` flag despite the nav showing it as admin-only.

**Impact**: an unauthenticated visitor hitting `/sales-orders` directly wasn't redirected to `/login` like every other protected route, and any authenticated non-admin (including the `external` role) could read all sales orders — customer names, amounts, line items — via the page or the API directly.

**Fix**: added `/sales-orders` to both `matcher` and `ADMIN_ONLY_PREFIXES`, and added `{ adminOnly: true }` to the list route's `requireSession` call, matching how every other admin-only feature in this app is gated.

## CRM: middleware SSO check doesn't match its own `lib/sso.js`

**Found by**: the audit's cross-cutting middleware-consistency check — CRM's `middleware.js` verified its SSO fallback cookie with a JWT check that only used `JWT_SECRET` (no `SSO_JWT_SECRET` fallback) and never checked the `sso: true` claim, unlike the other 5 apps' middleware and unlike CRM's own `lib/sso.js` (which does both correctly).

**Impact**: if `SSO_JWT_SECRET` is ever set to a different value than `JWT_SECRET` in production (which `ERP_DEPLOYMENT.md` explicitly allows), a user authenticated via the shared SSO cookie would be silently locked out of every CRM page while still being accepted by CRM's own API routes.

**Fix**: `middleware.js` now verifies the SSO cookie the same way `lib/sso.js` does — `SSO_JWT_SECRET` falling back to `JWT_SECRET`, and requiring `payload.sso === true`.

## Known limitations (not errors — explicitly out of scope this session)

1. **PDF visual parity with Quotation's document pipeline** — Accounting's invoice/bill "Print/PDF" uses the browser's native print dialog (a real, working PDF path via "Save as PDF"), not the same jsPDF/puppeteer/Arabic-shaping engine Quotation uses for its formal customer-facing documents. Replicating that exact pipeline for accounting documents is a substantial, separate effort — see `ERP_REMAINING.md`.
2. **Admin UI for `app_permissions`** exists only in the Projects app's Users page — the other 5 apps have the enforcement (API + switcher) but not a management screen. A super-admin can grant access from Projects and it takes effect everywhere via the shared `app_permissions` table.

Resolved this session (previously listed here): **barcode/QR generation in Inventory**, **ZATCA Phase 1 QR code on invoices**, and the **full Sales Order pipeline** — see `ERP_COMPLETED.md`.
