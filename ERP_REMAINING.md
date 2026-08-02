# ERP Remaining Work

## Requires Supabase Dashboard Access (blocking — nothing beyond this can be tested live)

Run these SQL files **in order** in the Supabase SQL editor. None have been applied yet — the database has zero rows for any `acc_*`/`crm_*`/new `inv_*` table.

1. `supabase/inv-schema-v01-initial.sql` (if not already run)
2. `supabase/inv-schema-v02-cross-app.sql`
3. `supabase/inv-schema-v03-issue-transfer-reservation.sql` — Goods Issue/Transfers/Reservations + the `inv_stock_movements` column fix
4. `supabase/inv-schema-v04-accounting-schema-fix.sql` — **critical**, corrects the entire accounting schema to match the working API (see `ERP_ERRORS.md`)
5. `supabase/inv-schema-v05-purchasing-destination.sql` — adds Purchasing destination fields to `acc_bills`
6. `supabase/inv-schema-v06-crm-cross-links.sql` — adds `crm_deals.linked_quotation_id`/`linked_project_id`
7. `supabase/inv-schema-v07-app-permissions.sql` — the shared `app_permissions` table
8. `supabase/inv-schema-v08-sales-orders.sql` — `sales_orders`/`sales_order_lines` (Quotation → Reserve → Deliver → Invoice → Paid pipeline, this session)

None have been applied yet — see `ERP_DEPLOYMENT.md` for the full step-by-step (getting keys, creating the super-admin row, granting initial `app_permissions`).

## Requires Environment Variables

`.env.example` now exists in all 6 apps (`apps/<app>/.env.example`), listing exactly the variables that app's code reads. See `ERP_DEPLOYMENT.md` §2 for the full table (shared vars, sibling app URLs, and each app's extras) and where each value comes from.

## Immediately Buildable (No External Credentials Needed) — Prioritized Next Steps

### 1. PDF pipeline parity with Quotation
Quotation's document PDFs use `jspdf` + `jspdf-autotable` + `html2canvas` + `qrcode` client-side, with a server route (`api/quotations/[id]/pdf`) using `puppeteer-core`/`@sparticuz/chromium` for true server-rendered PDFs, including Arabic text shaping via canvas. Accounting currently only has a `window.print()` button (a real, working "Save as PDF" path, just not the same branded pipeline). Replicating the full engine for Accounting is a self-contained follow-up:
- Copy `apps/quotation/lib/pdf/*` patterns
- Build an invoice/bill-specific document template (reuse `apps/inventory/lib/reportPdf.js` tabular engine as a simpler starting point if a full branded invoice layout isn't required immediately)

### 2. `app_permissions` admin UI in the other 5 apps
The enforcement (API + switcher) works everywhere via the shared table; only Projects' Users page has a UI to grant/revoke. Either mirror that checkbox section into the other apps' Users pages, or build one canonical "App Access" screen all apps deep-link to.

### 3. Unify the two divergent Users page implementations
The audit found Projects and Quotation each built their own independent Users management page (different components, different API routes — `/api/users` vs `/api/admin/users` — different role vocabularies). The task's "one shared Users module, same UI everywhere" requirement is not met — this exists as two parallel implementations, not one shared one. A real fix means either:
- Picking one as canonical and pointing every app's `/users` route at it (requires resolving the role-vocabulary differences: projects has `admin/viewer/external`, quotation has `admin/manager/sales/estimator/accountant/production/readonly`), or
- Building a genuinely new shared component imported by all 6 apps.
Either path is a meaningful refactor across apps explicitly protected from workflow changes — flagged here rather than attempted under time pressure.

### 4. Shared Notifications and Shared Audit Logs
Still fragmented per-app (`public.notifications`, `qt_notifications`, `public.admin_notifications` / `public.audit_logs`, `platform_activity_log`, `qt_audit_logs`) — no unified cross-app table or UI. Not attempted this session; a real implementation needs a `platform_notifications`/`platform_audit_log` table plus a bell-icon component mirrored across all 6 apps, consistent with every other shared-component pattern in this codebase.

### 5. Sales Order polish (optional follow-up, not blocking)
The tracked entity itself is done (see `ERP_COMPLETED.md`), including a duplicate-guard (re-clicking "Create Sales Order" on the same Quotation Request returns the existing order instead of spawning a second one). One remaining nice-to-have if picked back up: a quotation picker on the standalone "+ New Sales Order" modal (currently that modal only takes customer/currency/notes; linking to a quotation is only offered from the Quotation Request detail page's shortcut).

## Phase 4 — HR & Payroll (Explicitly Deferred)

See `ERP_NEXT_PHASE.md` for the full plan. Per project instructions, do not build until Phases 1-3 are live and tested in production.

## Phase 5 — Advanced ERP Features (Future)

- Manufacturing/production orders (Wood Works, Steel Works, Aluminium Works)
- Bill of Materials (BOM)
- WIP inventory valuation
- Customer/vendor self-service portals
- Mobile-first PWA wrappers
- Power BI / Metabase integration for executive dashboards
