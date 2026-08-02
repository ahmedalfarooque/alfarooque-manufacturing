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

## Requires Environment Variables

`apps/accounting/.env.local` and `apps/crm/.env.local` need:
```
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
```
(Same as every other app — these two were the last to be scaffolded.)

## Immediately Buildable (No External Credentials Needed) — Prioritized Next Steps

### 1. ZATCA Phase 1 QR code on invoices
Requires `npm install qrcode` in `apps/accounting` (not attempted this session — no confirmed package registry access). Once installed:
- Generate the TLV-encoded base64 payload (seller name, VAT number, timestamp, invoice total, VAT total)
- Render as a QR image on the invoice detail/print page
- The invoice detail page (`app/(protected)/invoices/[id]/page.js`) already has a `print:` CSS section ready for this addition

### 2. PDF pipeline parity with Quotation
Quotation's document PDFs use `jspdf` + `jspdf-autotable` + `html2canvas` + `qrcode` client-side, with a server route (`api/quotations/[id]/pdf`) using `puppeteer-core`/`@sparticuz/chromium` for true server-rendered PDFs, including Arabic text shaping via canvas. Accounting currently only has a `window.print()` button (a real, working "Save as PDF" path, just not the same branded pipeline). Replicating the full engine for Accounting is a self-contained follow-up:
- Copy `apps/quotation/lib/pdf/*` patterns
- Build an invoice/bill-specific document template (reuse `apps/inventory/lib/reportPdf.js` tabular engine as a simpler starting point if a full branded invoice layout isn't required immediately)

### 3. Full Sales Order pipeline as a tracked entity
The individual pieces all exist and work:
- Quotation creates quotes (existing, untouched)
- CRM deals can link to a Quotation (`linked_quotation_id`, added this session)
- Inventory has Reservations (added this session) to hold stock before delivery
- Inventory has Goods Issue (added this session) to record delivery
- Accounting has Invoices with line items (added this session) and Payments

What's missing is a single **Sales Order** record that ties a Quotation → reserved stock → delivery → invoice together as one auditable chain, with status transitions (`Draft → Confirmed → Reserved → Delivered → Invoiced → Paid`). Recommended shape for a follow-up:
```sql
create table sales_orders (
  id uuid primary key default gen_random_uuid(),
  so_number text unique,
  quotation_id uuid references qt_quotations(id),
  customer_name text not null,
  status text not null default 'Draft' check (status in
    ('Draft','Confirmed','Reserved','Delivered','Invoiced','Paid','Cancelled')),
  reservation_ids uuid[],      -- or a join table sales_order_reservations
  invoice_id uuid references acc_invoices(id),
  created_at timestamptz not null default now()
);
```
A UI in either Projects or a new shared "Sales" area would drive: create SO from a won Quotation → call Inventory's `/api/reservations` for each line → on delivery call `/api/reservations/[id]` with `action=fulfill` (already implemented) → create the Accounting invoice with `lines` pre-filled from the SO → mark the SO `Invoiced`.

### 4. Barcode/QR generation in Inventory
Add `jsbarcode` (or `qrcode`) to `apps/inventory/package.json`, generate a printable item card from the existing `barcode` text field.

### 5. `app_permissions` admin UI in the other 5 apps
The enforcement (API + switcher) works everywhere via the shared table; only Projects' Users page has a UI to grant/revoke. Either mirror that checkbox section into the other apps' Users pages, or build one canonical "App Access" screen all apps deep-link to.

### 6. Unify the two divergent Users page implementations
The audit found Projects and Quotation each built their own independent Users management page (different components, different API routes — `/api/users` vs `/api/admin/users` — different role vocabularies). The task's "one shared Users module, same UI everywhere" requirement is not met — this exists as two parallel implementations, not one shared one. A real fix means either:
- Picking one as canonical and pointing every app's `/users` route at it (requires resolving the role-vocabulary differences: projects has `admin/viewer/external`, quotation has `admin/manager/sales/estimator/accountant/production/readonly`), or
- Building a genuinely new shared component imported by all 6 apps.
Either path is a meaningful refactor across apps explicitly protected from workflow changes — flagged here rather than attempted under time pressure.

### 7. Shared Notifications and Shared Audit Logs
Still fragmented per-app (`public.notifications`, `qt_notifications`, `public.admin_notifications` / `public.audit_logs`, `platform_activity_log`, `qt_audit_logs`) — no unified cross-app table or UI. Not attempted this session; a real implementation needs a `platform_notifications`/`platform_audit_log` table plus a bell-icon component mirrored across all 6 apps, consistent with every other shared-component pattern in this codebase.

## Phase 4 — HR & Payroll (Explicitly Deferred)

See `ERP_NEXT_PHASE.md` for the full plan. Per project instructions, do not build until Phases 1-3 are live and tested in production.

## Phase 5 — Advanced ERP Features (Future)

- Manufacturing/production orders (Wood Works, Steel Works, Aluminium Works)
- Bill of Materials (BOM)
- WIP inventory valuation
- Customer/vendor self-service portals
- Mobile-first PWA wrappers
- Power BI / Metabase integration for executive dashboards
