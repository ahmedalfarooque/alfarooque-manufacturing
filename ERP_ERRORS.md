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

## Known limitations (not errors — explicitly out of scope this session)

1. **Barcode/QR code generation** in Inventory — no `jsbarcode`/`qrcode` dependency installed; `barcode` remains a plain text field.
2. **ZATCA Phase 1 QR code** (scannable image on invoices) — requires installing the `qrcode` npm package (network/registry access was not available to test this in-session); the invoice PDF currently uses a plain `window.print()` flow without a QR stamp.
3. **PDF visual parity with Quotation's document pipeline** — Accounting's invoice/bill "Print/PDF" uses the browser's native print dialog (a real, working PDF path via "Save as PDF"), not the same jsPDF/puppeteer/Arabic-shaping engine Quotation uses for its formal customer-facing documents. Replicating that exact pipeline for accounting documents is a substantial, separate effort — see `ERP_REMAINING.md`.
4. **Full Sales Order pipeline** (Quotation → Sales Order → Inventory Check → Reserve Stock → Delivery → Invoice → Payment → Accounting) as a single tracked entity — the individual pieces all exist and work (Quotation, Inventory reservations, Accounting invoices/payments, CRM deal links), but there is no dedicated "Sales Order" record connecting them end-to-end yet. See `ERP_REMAINING.md`.
5. **Admin UI for `app_permissions`** exists only in the Projects app's Users page — the other 5 apps have the enforcement (API + switcher) but not a management screen. A super-admin can grant access from Projects and it takes effect everywhere via the shared `app_permissions` table.
