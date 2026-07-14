# AL FAROOQUE — ERP Modules & Connection Structure

This document maps the AL FAROOQUE ERP as it exists today, explains **how the
web apps connect to each other**, and lays out the **remaining modules** needed
to complete a full manufacturing ERP — in the order they should be built.

It is a planning/architecture reference. It changes no code. It follows the
conventions already established in `apps/DEPLOYMENT.md`, `AUTH_SETUP.md`,
`lib/sso.js`, and `lib/appLinks.js`.

---

## 1. The suite today (what is already built)

The ERP is **not one app** — it is a *suite of independently deployed Next.js
apps* that share a single Supabase project and a single admin sign-on. Each app
is its own Vercel project on its own subdomain, so a bug in one can never take
down another.

| App | Subdomain | Dev port | Table prefix | Status |
|-----|-----------|----------|--------------|--------|
| **QuotePro** (`apps/quotation`) | `quotation.alfarooque.com` | 3030 | `qt_` | ✅ Built |
| **Projects** (`apps/projects`) | `projects.alfarooque.com` | 3020 | `pm_` | ✅ Built |
| **Car Inventory** (`apps/cars`) | `cars.alfarooque.com` | 3010 | `car_` | ✅ Built |
| **Public website + e-commerce** (repo root) | `alfarooque.com` | 3000 | `products`, `orders`, `profiles`, … | ✅ Built |

### Modules already shipping

- **QuotePro** — Quotations, Materials, Labour, Machines, Suppliers, Customers,
  Catalogue, Cost Models, Expenses, Reports, Audit, Settings, Users.
- **Projects** — Projects, Orders, Quotes, Purchase Requests, Quotation
  Requests, Customers, Daily Updates, Notifications, Users, Dashboard.
- **Car Inventory** — Vehicles, Drivers, Maintenance, Maintenance Schedule,
  Maintenance Shops, Alerts, Dashboard.
- **Public site** — Product catalogue, e-commerce cart/wishlist/addresses,
  customer accounts (Supabase Auth), quote requests, and an admin API
  (`/api/admin/*`) for orders/quotes/products/customers/notifications.

### What already connects the apps

1. **One Supabase project** for everything, with isolated table prefixes per
   app so nothing collides.
2. **Admin SSO** (`lib/sso.js`) — one `af_sso_session` JWT cookie scoped to
   `.alfarooque.com`; an admin signed into any app is recognised by all three.
   Requires the **same `SSO_JWT_SECRET`** on all three Vercel projects.
3. **App switcher** (`components/AppSwitcherButtons.js`) — admin-only header
   buttons that jump between apps; URLs resolved by `lib/appLinks.js`.
4. **Shared preferences** — theme (`af_theme`) and language (`af_lang`) cookies
   follow the admin across apps.
5. **Cross-module data flow already wired**: QuotePro → Projects
   (`send-to-projects`), shared customers (`apps-schema-v9-shared-customers`),
   and project requests (`apps-schema-v10-project-requests`).

---

## 2. Connection structure (the pattern every new module/app must follow)

New modules are added **one of two ways**. Pick per module using the rule below.

### A. New *page/route inside an existing app* (a sub-module)
Use this when the data belongs to an app that already exists (e.g. a "Payments"
page inside QuotePro). Cheapest path — no new deployment.

```
apps/<app>/app/(protected)/<module>/page.js      ← list view
apps/<app>/app/(protected)/<module>/[id]/page.js  ← detail view
apps/<app>/app/api/<module>/route.js               ← collection API
apps/<app>/app/api/<module>/[id]/route.js          ← item API
apps/<app>/lib/<module>Core.js                     ← shared business logic
supabase/<prefix>-schema-vNN-<module>.sql          ← additive migration
```

### B. New *standalone app* (a top-level ERP pillar)
Use this when the domain is large and independently owned (e.g. Finance, HR,
Inventory). Mirrors `apps/cars`. To add one, in this exact order:

1. **Scaffold** by copying an existing app's skeleton (`apps/cars` is the
   smallest). Keep `components/Shell.js`, `middleware.js`, `lib/sso.js`,
   `lib/appLinks.js`, `components/AppSwitcherButtons.js`, `lib/i18n.js`,
   Tailwind + fonts.
2. **Pick a subdomain, dev port, and table prefix** (see the reserved list in
   §4) and register the app in `lib/appLinks.js` **`APPS`** array —
   then copy that file to all sibling apps (they must stay byte-identical).
3. **Add the app to the switcher** — extend `ORDER`, `LABELS`, and
   `APP_COOKIE_NAMES` in `lib/sso.js`, copied to every app.
4. **Write an additive schema** `supabase/<prefix>-schema.sql` — new tables
   only, RLS on, never touch another module's tables.
5. **Deploy** as its own Vercel project with the shared `SSO_JWT_SECRET`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a **unique** `JWT_SECRET`,
   then bind the subdomain (full recipe in `apps/DEPLOYMENT.md`).

### Non-negotiable conventions (already in force — keep them)

- **Additive migrations only.** Every schema file is versioned
  (`…-vNN-<what>.sql`) and never edits or drops another module's tables.
- **Table prefixes** isolate ownership: `qt_`, `pm_`, `car_`. Any new app gets
  its own prefix.
- **Shared identity is by ID, not by copy.** Customers, users, and products are
  referenced across apps by their Supabase row ID (see
  `apps-schema-v9-shared-customers` and `schema-orders-quotes-shared-ids`) —
  do **not** duplicate a customer's data into each app.
- **Mirrored files stay identical.** `sso.js`, `appLinks.js`,
  `AppSwitcherButtons.js` are copied verbatim across apps; edit once, copy over.
- **Bilingual + RTL** via `lib/i18n.js` for every new screen (EN/AR).
- **RBAC**: `admin` sees everything and crosses apps; other roles are scoped to
  their own app and rows.

---

## 3. Remaining modules (gap analysis for a complete manufacturing ERP)

AL FAROOQUE manufactures across three divisions (Wood, Steel, Aluminium). The
suite today covers **sales-side** (quoting, projects) and **fleet**. The gaps
below are what turn it into a full manufacturing ERP. Ordered by
business impact.

> Legend — **Build as**: `App` = new standalone app (pattern B) ·
> `Module` = pages inside an existing app (pattern A).

### 🔴 Priority 1 — core operational gaps

**1. Inventory & Warehouse** — *Build as: App* (`inv.alfarooque.com`, prefix `inv_`)
> Today `qt_materials` are *costing* rows, not real stock. There is no on-hand
> quantity, no locations, no goods movement.
- Items/SKUs (linked to `qt_materials` & `products` by ID), warehouses &
  bins, stock on-hand, goods receipt (GRN), issue/consumption, transfers,
  stock adjustments, reorder levels & low-stock alerts, batch/lot tracking,
  stock valuation (FIFO/weighted avg).
- Tables: `inv_items`, `inv_warehouses`, `inv_stock`, `inv_movements`,
  `inv_grn`, `inv_adjustments`, `inv_reorder_rules`.

**2. Procurement / Purchasing** — *Build as: Module in QuotePro* (prefix `qt_po_`)
> Projects has internal *purchase requests*; there is no external **Purchase
> Order → supplier → receipt → invoice** loop.
- Convert an approved `pm_purchase_request` into a **PO** to a `qt_supplier`,
  multi-level approval, goods receipt against PO (feeds Inventory GRN),
  supplier bills matched 3-way (PO ↔ GRN ↔ invoice), supplier price history
  (already have `qt_material_price_history`).
- Tables: `qt_purchase_orders`, `qt_po_lines`, `qt_po_receipts`,
  `qt_supplier_invoices`.

**3. Production / Manufacturing (MRP)** — *Build as: App* (`production.alfarooque.com`, prefix `mfg_`)
> **The biggest gap for a manufacturer.** No BOM, no work orders, no shop-floor
> tracking. This is where quotes/projects become physical output.
- Bill of Materials (per product/division), work orders from a project/order,
  routing & operations, machine loading (reuse `qt_machines`), shop-floor
  status (per division: Wood/Steel/Aluminium), WIP tracking, material
  reservation & consumption (feeds Inventory), scrap/rework, capacity planning.
- Tables: `mfg_bom`, `mfg_bom_lines`, `mfg_work_orders`, `mfg_operations`,
  `mfg_wo_materials`, `mfg_wo_time_logs`, `mfg_scrap`.

### 🟠 Priority 2 — financial & people backbone

**4. Finance & Accounting** — *Build as: App* (`finance.alfarooque.com`, prefix `fin_`)
> Expenses exist in QuotePro but there is no ledger, AR/AP, or compliant
> invoicing.
- Chart of accounts & general ledger, accounts receivable (customer invoices
  from orders/projects) & accounts payable (from supplier invoices), payments &
  receipts, bank/cash, **Saudi VAT + ZATCA e-invoicing (Fatoora / QR)** — a
  hard compliance requirement in KSA, expense management (absorb
  `qt_expenses`), P&L / balance sheet / cash-flow reports.
- Tables: `fin_accounts`, `fin_journal`, `fin_journal_lines`, `fin_invoices`,
  `fin_payments`, `fin_tax_returns`.

**5. HR & Payroll** — *Build as: App* (`hr.alfarooque.com`, prefix `hr_`)
- Employee directory, attendance/shifts (shop-floor clock-in ties to
  Production time logs), leave management, payroll runs, **GOSI** & end-of-
  service, Iqama/visa expiry alerts (KSA-specific), documents.
- Tables: `hr_employees`, `hr_attendance`, `hr_leave`, `hr_payroll_runs`,
  `hr_payslips`, `hr_documents`.

### 🟡 Priority 3 — cross-cutting & polish

**6. CRM / Sales Pipeline** — *Build as: Module in Projects* (prefix `crm_`)
> Quotation requests exist but there is no lead → opportunity → won/lost funnel.
- Leads, opportunities/pipeline stages, activities & follow-ups, customer 360
  (pulls quotes, orders, projects, invoices for one customer by ID).

**7. Fixed Assets & Maintenance** — *Build as: extend Car Inventory* (prefix `asset_`)
> Cars app already does vehicle maintenance — generalise it to plant/machinery.
- Asset register, depreciation schedules, preventive maintenance for factory
  machines (reuse the `car_maintenance` model), warranty tracking.

**8. Business Intelligence / Executive Dashboard** — *Build as: Module (new landing app or `apps/projects` home)*
- Cross-module KPIs for management: revenue vs. cost, project margins,
  production throughput per division, inventory value, cash position — reads
  (read-only) across all prefixes.

**9. Central Document Management** — *Build as: shared library + Supabase Storage convention*
- One `documents` bucket pattern + a `documents` table with `entity_type` /
  `entity_id`, so any module attaches files the same way (Projects already has
  `pm_project_documents` — promote that pattern to a shared helper).

**10. Notifications & Approvals engine** — *Build as: shared library*
- Generalise `pm_*`/`qt_notifications` into one approvals/notifications helper
  (email via existing `lib/email.js` + Resend, in-app bell) that any module
  reuses for multi-step approval chains (POs, leave, payments).

---

## 4. Reserved subdomains, ports & prefixes (register new apps here)

Keep this table authoritative so two apps never collide. Update
`lib/appLinks.js` and `lib/sso.js` whenever a new app graduates from planned to
built.

| App | Subdomain | Dev port | Prefix | State |
|-----|-----------|----------|--------|-------|
| QuotePro | quotation | 3030 | `qt_` | ✅ |
| Projects | projects | 3020 | `pm_` | ✅ |
| Car Inventory | cars | 3010 | `car_` | ✅ |
| Inventory & Warehouse | inv | 3040 | `inv_` | 🔲 planned |
| Production / MRP | production | 3050 | `mfg_` | 🔲 planned |
| Finance & Accounting | finance | 3060 | `fin_` | 🔲 planned |
| HR & Payroll | hr | 3070 | `hr_` | 🔲 planned |

*(Procurement, CRM, Fixed Assets, BI, Documents are modules inside existing
apps — no new subdomain/port needed.)*

---

## 5. Recommended build order

The dependency chain that unlocks the most value fastest:

1. **Inventory** — everything downstream (procurement receipts, production
   consumption, finance valuation) needs real stock first.
2. **Procurement** — turns the existing purchase requests into real supplier
   POs and feeds Inventory.
3. **Production / MRP** — the core manufacturing loop; consumes Inventory,
   produces finished goods, closes projects.
4. **Finance** — invoices the orders/projects, pays the supplier bills, and is
   **legally required** for ZATCA e-invoicing in KSA.
5. **HR & Payroll** — people backbone; attendance ties into Production.
6. **CRM, Fixed Assets, BI, Documents** — polish and management visibility,
   built as modules on top of the pillars above.

Each pillar is shippable on its own the day its subdomain resolves — the SSO +
app-switcher pattern means it lights up in every admin's header automatically,
with zero changes to the apps already in production.

---

## 6. One-glance architecture

```
                         ┌──────────────────────────────┐
                         │      Supabase (one project)   │
                         │  qt_*  pm_*  car_*  inv_* …    │
                         │  platform_users / _sessions    │
                         │  admin_users · profiles(auth)  │
                         └───────────────┬────────────────┘
                                         │ service-role (server-side only)
      ┌──────────────┬──────────────┬────┴─────────┬──────────────┬─────────────┐
      ▼              ▼              ▼              ▼              ▼             ▼
  QuotePro       Projects      Car Inv.      Inventory      Production      Finance …
 quotation.     projects.      cars.         inv.           production.     finance.
   :3030          :3020         :3010         :3040           :3050           :3060
      └──────────────┴──────── af_sso_session (.alfarooque.com) ──────────────┘
                    Admin SSO · app switcher · shared theme/lang
                                         │
                          Public site  alfarooque.com  (Supabase Auth e-commerce)
```

**In one sentence:** every ERP pillar is its own small Next.js app on its own
subdomain, they all read/write one prefixed Supabase database, and one admin
SSO cookie + the header app-switcher stitch them into a single ERP experience.
