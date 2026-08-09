# ERP Completed Features

> Verified against actual source code (not just prior documentation) as of this session. Every claim below was confirmed by reading the implementation, and every affected app builds clean (`npx next build`).

## Phase 1 — Inventory App (`localhost:3040`)

### Core (verified pre-existing)
- Products, Materials, Categories/Subcategories, Suppliers, Brands, Units — full CRUD
- Warehouses, Locations
- Stock ledger (`inv_stock`) with per-warehouse quantity + average cost
- Stock adjustments (manual in/out)
- Goods Receipts (from suppliers, updates stock + average cost)
- Purchase Requests, Purchase Orders — full CRUD workflow
- Low-stock alerts, supplier management
- Reports: stock valuation, movement history, low stock (Recharts visualizations)
- Full Arabic/English i18n with RTL, dark/light theme
- OTP auth + SSO

### Completed this session (previously missing or broken)
- **Goods Issue** — new page + API (`/goods-issues`). Issues stock out of a warehouse to a project/department/sales order/other, decrements `qty_on_hand`, writes an `issue` stock movement.
- **Stock Transfers** — new page + API (`/transfers`). Warehouse-to-warehouse moves; decrements source, increments destination, writes paired `transfer_out`/`transfer_in` movements.
- **Stock Reservations** — new page + API (`/reservations`). Soft-holds available stock (`qty_reserved`) with **Fulfill** (converts to an actual issue) and **Release** actions.
- **PDF export wired up** — the existing `lib/reportPdf.js` engine (present but never called by any page) is now wired to an "Export PDF" button on the Reports page for stock valuation, movements, low stock, and purchase orders.
- **Bugfix**: `inv_stock_movements.reference_type`/`reference_id` were written by the Goods Receipts route but never existed as columns — every receipt would have thrown a Postgres error. Fixed via `ALTER TABLE`.
- **Bugfix**: `inv_products.qty_on_hand` / `inv_materials.qty_on_hand` (the denormalized totals read by Products/Materials lists and by every cross-app inventory-search endpoint) were never updated by any route — always stuck at 0. Added `lib/stockSync.js`, called after every stock mutation (adjustments, receipts, issues, transfers, reservation fulfillment).

### Known remaining gap
- Barcode/QR **generation** (a printable card with a scannable code) is not implemented — `barcode` is a plain text field. No `jsbarcode`/`qrcode` dependency is installed. See `ERP_REMAINING.md`.

## Cross-App Inventory Integration

- `inventory-search` API routes in Quotation, Projects, Cars (added in a prior session) were real and functional but had **zero frontend consumers** — confirmed by audit, now fixed:
  - **Projects**: the Purchase Request creation modal now has an optional "Link to Inventory Item" search that sets `inv_material_id`/`inv_product_id` (the API already accepted these fields — no UI ever offered a way to set them).
  - **Cars**: the Maintenance Record creation modal now has an optional inventory parts picker that populates `car_maintenance_parts` with real `inv_product_id` links (the API already supported a `parts_list` array — no UI ever sent one).
  - **Quotation**: intentionally left as-is. Its `qt_materials`/`qt_catalogue_products` are a deliberately separate pricing/catalogue system for building customer quotes, not a stock-tracking duplicate — and Quotation is explicitly protected from workflow changes. See `ERP_REMAINING.md`.
- Accounting also gained its own `inventory-search` + `warehouses` routes (see below) as part of the Purchasing destination feature.

## Phase 2 — Accounting App (`localhost:3050`)

### Critical fix: schema/API mismatch
The entire `acc_*` schema in `inv-schema-v02-cross-app.sql` was drafted independently from the Next.js API routes actually built against it — different column names throughout (`code` vs `account_code`, `entry_number` vs `journal_number`, `supplier_name` vs `vendor_name`, `txn_date` vs `transaction_date`, etc.), different status-enum casing (`'draft'` vs `'Draft'`), a payments model with the wrong type vocabulary and missing columns, and **no `acc_settings` table at all** despite the Settings page depending on it. Since nothing had been deployed to Supabase yet, `supabase/inv-schema-v04-accounting-schema-fix.sql` drops and recreates every mismatched table to match the working application code exactly. See `ERP_ERRORS.md` for the full list.

### General Ledger
- Chart of Accounts: full CRUD
- Journal Entries: list, post, void — **creation page added this session** (`/journal-entries/new` was a dead link before; the API already supported posting balanced debit/credit lines)

### Accounts Receivable / Accounts Payable
- Invoices and Bills: Draft→Sent/Unpaid→Paid workflows
- **Line items added this session**: both create modals now support multiple description/qty/unit-price/tax-rate rows with auto-computed subtotal/tax/total, falling back to manual totals when no lines are entered
- **Detail pages added this session** (`/invoices/[id]`, `/bills/[id]`) — previously missing entirely; show line items, running totals, status actions, and a Print/PDF button (`window.print()` with print-friendly layout)

### Purchasing (new this session)
Every vendor bill now resolves to one of three destinations, matching the required flow:
- **Warehouse** — bill lines linked to a real inventory product/material (via a new inventory-search picker) directly increase `inv_stock` and write `inv_stock_movements` when the bill is created. Inventory remains the sole source of stock.
- **Running Project** — cost assigned via `project_id`, no inventory change.
- **Company Asset** — automatically registers a new `acc_assets` fixed-asset row from the bill's vendor/date/total.

### Payments, Banking, Expenses, Fixed Assets
- Full CRUD, verified working against the corrected schema

### Reports
- Income Statement, Balance Sheet, Cash Flow, VAT — pre-existing, now correct against the fixed schema
- **Inventory Valuation** (new) — reads `inv_stock`/`inv_products`/`inv_materials` directly, aggregates value by warehouse and by item
- **Project Costing** (new) — reads `pm_projects` directly, attaches project names to bills/expenses (cost) and invoices (revenue) tagged with a `project_id`, computes margin per project

### Settings
- Company info, VAT/CR numbers, numbering prefixes — now backed by a real `acc_settings` table (previously didn't exist)

## Phase 3 — CRM App (`localhost:3060`)

### Pre-existing (verified largely complete by audit)
- Contacts (Lead/Prospect/Customer/Partner/Supplier via `contact_type` enum on one shared table — not separate modules)
- Deals with full pipeline stages, kanban board
- Activities (Call/Meeting/Email/Demo/Follow-up/Task/Note via `activity_type` enum — Meetings/Calls/Tasks are all activities, not separate modules)
- Dashboard, Reports, Settings

### Completed this session
- **Deal Edit Modal** — previously only Mark Won/Lost existed; the PATCH API accepted full field updates but no UI offered them. Added.
- **Contact Edit Modal** — previously only Convert-to-Prospect/Customer existed. Added.
- **Cross-app links** — `crm_deals.linked_quotation_id`/`linked_project_id` (nullable FKs to `qt_quotations`/`pm_projects`) let a deal reference the Quotation/Project it originated from. The deal API reads the linked record's name/status directly; the detail page displays and edits the links.

## Shared Platform Layer (cross-cutting, new this session)

- **`app_permissions` table** — gates which of the 6 ERP apps a user's Application Switcher shows. Admins and the super-admin account (`arshad@alfarooque.com`) always see every app; non-admins see exactly what's granted (safe default-deny, since the switcher previously hid itself entirely for every non-admin).
- **`/api/app-permissions` route** mirrored across all 6 apps (GET own/admin-view-another's granted apps; POST admin-only to set a user's grant list).
- **AppSwitcherButtons.js rewritten** across all 6 apps — visible to any authenticated user (not just admins), renders only permitted apps from the full 6-app list (previously hardcoded 3-4 apps per copy, always missing at least Accounting/CRM).
- **"App Access" admin UI** — added to the Projects app's existing Users page (the more feature-complete of the two divergent Users implementations found by audit) so an admin can grant/revoke app access without touching the database.
- **Bugfix**: `lib/sso.js` in Quotation/Projects/Cars/Inventory was missing `af_accounting_session`/`af_crm_session` from `APP_COOKIE_NAMES` — admin logout-everywhere never cleared those two apps' sessions.
- **Bugfix**: `lib/appLinks.js` in the same four apps only listed 4 of 6 apps — admins could never switch to Accounting or CRM from those apps.
- **Bugfix**: `apps/cars/lib/auth.js` was missing the super-admin override present in every other app — `arshad@alfarooque.com` was not automatically treated as admin in Cars.

## Phase 4 — Post-Audit Follow-Through (this session)

Closed out the three items `ERP_REMAINING.md` had flagged as "immediately buildable, no external credentials needed":

- **ZATCA Phase 1 QR code on invoices** — `apps/accounting/lib/zatca.js` builds the Base64 TLV payload (seller name, VAT number, timestamp, invoice total, VAT total); a new server-side route `app/api/invoices/[id]/qr/route.js` renders it via the `qrcode` package and the invoice detail page displays it next to the totals block.
- **Barcode/QR generation in Inventory** — the Products page gained a per-row "Print Label" action (`LabelModal`) that renders a scannable QR of the item's barcode/SKU plus a print-only CSS layout.
- **Sales Order tracked entity** — `sales_orders`/`sales_order_lines` (`supabase/inv-schema-v08-sales-orders.sql`) tie Quotation → Reserve Stock → Deliver → Invoice → Payment into one auditable record, built in the Projects app (`/sales-orders`). Reserve/Deliver actions inline the same stock-reservation/goods-issue logic Inventory's own endpoints use; Invoice creation writes directly into `acc_invoices`/`acc_invoice_lines`. A "Create Sales Order" shortcut was added to accepted Quotation Requests.
- **Deployment prep** — `.env.example` added to all 6 apps (verified against actual `process.env` usage), `vercel.json` added to Accounting/CRM (the two that were missing it), and a consolidated `ERP_DEPLOYMENT.md` covering Supabase migrations/keys, env vars, Vercel project creation, DNS, and Resend setup.
- **Bugfix**: CRM's `components/AppSwitcherButtons.js` imported `useLanguage` from `lib/i18n.js`, which only ever exported `useLang()` (CRM's i18n module is a smaller, standalone implementation, unlike the other 5 apps). The mismatched import resolved to `undefined` and would throw the moment the app switcher rendered — found during this session's final build-verification pass, fixed by switching to `useLang()`.
- **Permanent local dev ports** — reassigned Inventory (3050→3040), Accounting (3060→3050), CRM (3080→3060) so the full suite uses one contiguous block (Website 3000, Business Card 3005, Cars 3010, Projects 3020, Quotation 3030, Inventory 3040, Accounting 3050, CRM 3060); updated every app's `package.json` and the shared `lib/appLinks.js` dev-fallback table plus all docs that quoted the old ports.

## Phase 5 — Production Readiness Audit Fixes (this session)

A dedicated 7-agent read-only audit (per-app + cross-cutting schema-vs-code) surfaced 10 real code-level blockers — all fixed, none required external dashboard/SQL/DNS access. Full detail in `ERP_ERRORS.md`; summary:

- **Accounting + CRM login was completely broken** — both apps' OTP routes queried a nonexistent `otp_codes` table instead of the real `platform_otp_codes` (different column shape: `user_id`/`attempt_count`/`consumed_at`, not `email`/`attempts`/delete-on-use). Rewrote both routes to match the pattern already proven in `apps/cars`.
- **CRM Settings queried a nonexistent `crm_settings` table** — added via `supabase/inv-schema-v09-crm-settings.sql`.
- **CRM's `crm_contacts`/`crm_deals`/`crm_activities` schema diverged substantially from the working API** (column names, casing, enum values — the same class of drift the Accounting fix addressed once already). Fixed via `supabase/inv-schema-v10-crm-schema-fix.sql`, folding in the `linked_quotation_id`/`linked_project_id` columns from `inv-schema-v06-crm-cross-links.sql` so a table recreate doesn't drop them.
- **Inventory's Goods Receipt route called `sb.raw()`** (not a real Supabase JS client method) and wrote a nonexistent `po_item_id`/`location_id` column on every receipt, not just PO-linked ones. Fixed the code (read-then-update instead of raw SQL) and added the missing columns via `supabase/inv-schema-v11-goods-receipt-items-fix.sql`. Also added stock reversal to Goods Receipt deletion, which previously left on-hand quantity permanently inflated.
- **Sales Order reservation was non-atomic** — retrying a partially-failed "Reserve Stock" action would double-reserve lines that already succeeded. Fixed by skipping lines that already have a `reservation_id`.
- **Sales Order cancel had no status guard** — cancelling a Delivered order left issued stock un-reversed; cancelling an Invoiced order left the linked invoice untouched. Fixed: cancel now reverses issued stock for Delivered orders and cancels the linked invoice (unless already Paid) for Invoiced orders.
- **Accounting + CRM shipped with no `public/` folder** — broken `/logo.png` in both, and empty nav icons in Accounting specifically (whose `Shell.js` renders `<GlassIcon>`; CRM's nav uses plain emoji and was unaffected). Added the missing assets to both; also mounted CRM's previously-unmounted `GlassIconsLoader` for consistency.
- **Projects' `/sales-orders` was unguarded** — missing from `middleware.js`'s matcher/admin-only list despite being an admin-only nav item, and its list/detail API routes didn't enforce `adminOnly`. Fixed all three.
- **CRM's middleware SSO check didn't match its own `lib/sso.js`** — verified the SSO fallback cookie with `JWT_SECRET` only (no `SSO_JWT_SECRET` fallback, no `sso: true` check), unlike the other 5 apps. Fixed to match.

## Build Verification

All 6 Next.js apps build clean after every change in this session (including the Sales Order feature and the CRM fix above):

| App | Status |
|-----|--------|
| Inventory | ✓ Compiled successfully |
| Accounting | ✓ Compiled successfully |
| CRM | ✓ Compiled successfully (after `AppSwitcherButtons.js` fix) |
| Projects | ✓ Compiled successfully (incl. new Sales Order routes/pages) |
| Cars | ✓ Compiled successfully |
| Quotation | ✓ Compiled successfully |

Website (static) and Business Card (static) were not touched this session and remain unaffected.
