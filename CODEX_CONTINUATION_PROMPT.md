# Codex Continuation Prompt — AL FAROOQUE ERP / SmartLife Integration

## Continue from the current codebase. Do not rebuild, duplicate, or revert anything.

You are continuing an existing, working project. This is not a fresh build. Before writing any code, inspect the actual repository state — do not assume anything below is stale, and do not assume anything below is missing just because it isn't visible without inspecting.

---

## 1. What you must inspect first

1. `git status`, `git diff`, `git log -20` — understand what's committed vs uncommitted.
2. Repo root: `C:\Websites\alfarooque-manufacturing live` — a monorepo. Root `npm run dev` starts the main site + several ERP apps together (see `CLAUDE.md` at repo root for the exact port table). Preserve this dev workflow — do not replace it.
3. `apps/shared/integrationPlatform.js` — the ONE canonical SmartLife/SmartERP connector. Read it fully before touching SmartLife integration anywhere.
4. `apps/accounting/`, `apps/crm/`, `apps/inventory/`, `apps/projects/`, `apps/quotation/` — each is an independent Next.js app with its own `app/`, `lib/`, `components/`.
5. `apps/accounting/lib/smartlife.js` and `apps/inventory/lib/smartlife.js` — thin per-app proxies that forward to CRM's central route (`apps/crm/app/api/integrations/smartlife/data/[resource]/route.js`), which is the only place that actually calls `apps/shared/integrationPlatform.js`'s `readSmartLife()`. This proxy-through-CRM pattern is intentional — do not replace it with per-app direct connectors.
6. Supabase schema — use the Supabase MCP tools (`list_tables`, `execute_sql`) or `supabase/migrations/*.sql` to see the real current schema before creating anything.
7. Existing print/PDF architecture — `apps/accounting/components/InvoiceDocument.js` (shared by both sales and purchase invoices via a `docType` prop), `apps/accounting/lib/pdf/renderPdfServer.js` (Puppeteer-based, renders the print page server-side), and the equivalent quotation template system in `apps/quotation/`. These are the ONLY templates that may render an invoice/quotation/report — never SmartLife's own layout.
8. `apps/shared/integrationPlatform.test.js` and `apps/accounting/lib/smartlife.test.js` — the existing test suite (currently 16/16 passing). Run these before and after your changes.

---

## 2. Verified current state (as of the last audit)

- **SmartLife V3 connector is real and working.** Base `https://smarterp.top/api/v3/`. Login: `POST /user/login`, form-encoded (`login_company=alfarooqe`, `username=owner`, `password=<env>`, `app_type=desktop`, `app_version=1.0.0`), header `app-lang: arabic`. Authenticated requests: header `Authorization: access_token <TOKEN>`. Credentials live in root `.env.local` (`SMARTLIFE_API_BASE_URL`, `SMARTLIFE_COMPANY`, `SMARTLIFE_USERNAME`, `SMARTLIFE_PASSWORD`) — never hardcode them, never log them, never expose them client-side.
- **`SMARTLIFE_RESOURCES` in `apps/shared/integrationPlatform.js`** is the one and only endpoint map — verified against the real V3 OpenAPI spec, not guessed. It currently covers: products, clients, suppliers, sales, purchases, categories, brands, units, warehouses/branches, tax, gift cards, coupons, accounting/accounts, cost centers, users, cashiers. There is also a `SMARTLIFE_DETAIL_RESOURCES` map (get-by-id) and `SMARTLIFE_MISC_READ` (balances, movements, statuses, statistics). **Do not add a path that isn't verified against the real spec — no guessing.**
- **Hard read-only enforcement already exists**: `smartErpRequest()` in `integrationPlatform.js` structurally rejects any non-GET verb against SmartLife except the one login POST, and validates every path against an allow-list built from the resource maps above. This is load-bearing safety — do not weaken, remove, or bypass it.
- **Error classification** (`classifySmartErpError()` in `integrationPlatform.js`) returns one of: `connected`, `permission_required`, `endpoint_or_version_mismatch`, `connection_error`, `other_error`. This is wired through the full chain: CRM's central route → each app's local proxy → each app's local API route → the UI banner. **Preserve this taxonomy exactly** — a 401 with SmartERP's message `"The user is unauthorized to access the requested resource"` must always classify as `permission_required`, never as an endpoint or connection error.
- **Root cause of a real bug was just fixed**: `loadRootEnvironment()` in `integrationPlatform.js` used to resolve the root `.env.local` path via `__dirname` alone, which doesn't reliably match the real filesystem location once bundled through Next.js's server webpack compiler — causing SmartLife env vars to silently fail to load inside the running dev servers (but not in a plain `node` process), which cascaded into misclassified errors. Fixed by trying multiple path candidates (`__dirname`-relative and `process.cwd()`-relative). Verified live, through the actual browser-facing HTTP routes (not just a Node script): `sales-invoices` now correctly returns `permission_required`, and `categories` still returns real `200` data as before. **Do not revert this fix or reintroduce a single-path assumption.**
- **Current live permission status** (verified against the real API, not guessed): `categories` → HTTP 200, real (currently empty) dataset. Every other resource in the map above → HTTP 401, SmartERP message `"The user is unauthorized to access the requested resource"`, correctly shown in the UI as **Permission Required**, not an endpoint or connection error. This is a SmartLife-side account permission limitation, not a code bug — do not try to bypass it, do not guess alternate endpoints to work around it, do not fabricate data to hide it.
- **SmartLife quotations do not exist in the V2 or V3 spec** — confirmed by reading the full spec twice. Do not invent a quotation endpoint. The existing local QuotePro quotation workflow (`apps/quotation/`) remains fully authoritative and is untouched by any of this.
- **Accounting app** (`apps/accounting/`): sidebar (`components/Shell.js`) already exposes every SmartLife-backed module grouped logically (Accounting/Sales/Purchasing/Inventory/Other), routing through one generic resource page (`app/(protected)/smartlife/[resource]/page.js`) that handles search/filter/pagination/detail/permission-state/report-export generically for every resource key. Sales invoice and purchase invoice each have a dedicated print page + PDF route reusing the one shared `InvoiceDocument.js` template (`docType="sales"|"purchase"`). Local bookkeeping pages (`/invoices`, `/bills`, `/expenses`, `/payments`, `/dashboard`, `/chart-of-accounts`, `/banking`, `/assets`, `/journal-entries`) are separate, pre-existing, real local CRUD — distinct from the SmartLife-source view, do not merge or confuse the two.
- **CRM app** (`apps/crm/`): Customer-360 (`app/api/contacts/[id]/route.js` + `app/(protected)/contacts/[id]/page.js`) already reads real SmartLife customer/supplier/sales data through the shared connector, degrades safely (no crash, no fake data) when permission-blocked, and shows the same taxonomy (`Live`/`Permission required`/`Endpoint unavailable`/`Connection error`). The CRM dashboard (`app/api/dashboard/route.js` + `app/(protected)/dashboard/page.js`) was recently upgraded with real-data-only KPIs (Conversion Rate, New Customers This Month, Outstanding Receivables), a Deal Stage Distribution bar chart, Recent Quotations, and Recent Sales Invoices — all sourced from existing tables (`crm_deals`, `crm_contacts`, `crm_activities`, `qt_quotations`, `erp_financial_source_records`), zero fabricated values. A real pre-existing badge-tone bug (`GlassBadge` tone keys `success/error/info` don't exist in the tone table, silently fell back to gray) was fixed to `emerald/red/cyan`.
- **Inventory app** (`apps/inventory/`): had zero SmartLife wiring before the last pass. Now has `lib/smartlife.js` (proxy to CRM, mirrors Accounting's) and `app/api/smartlife/[resource]/route.js`, plus a "SmartLife Source" read-only panel (button + modal) on the Products page showing the same permission-state taxonomy. Local `inv_products` CRUD is untouched and separate.
- **Projects app** (`apps/projects/`): already reads SmartLife-derived data only from the local synced snapshot table `erp_financial_source_records` (via `erp_financial_connections`), not live from SmartLife — this was built in an earlier session and confirmed still correct; no change needed there structurally.
- **Shared database**: no duplicate tables exist. Key shared tables: `crm_integrations`, `crm_integration_module_status` (per-module sync status), `crm_record_mappings` (external-ID mapping), `crm_sync_runs`/`crm_sync_records` (sync history), `erp_financial_source_records` (SmartLife-sourced financial snapshot, currently holding real historical sales-invoice rows synced under a prior working connector), `erp_financial_connections` (links a source record to a project/PO/etc.), `erp_project_payments`. Inspect these via Supabase MCP before creating anything new — reuse first.
- **Zero temporary files remain** in the repo (all diagnostic/probe scripts from this session were created in the OS temp/scratchpad directory or deleted after use — never committed).
- **Tests: 16/16 pass** (`node --test apps/shared/integrationPlatform.test.js apps/accounting/lib/smartlife.test.js`). **Builds pass**: Accounting, CRM, Inventory all build clean (`next build`).

---

## 3. Absolute rules (non-negotiable)

- **SmartLife is READ-ONLY.** The only permitted request to SmartLife is `POST /user/login`. Never send POST/PUT/PATCH/DELETE that modifies SmartLife business data, even if the spec documents write endpoints. The existing hard block in `smartErpRequest()` already enforces this structurally — verify it still does after any change, don't just trust a comment.
- **No guessed endpoints.** Only use paths already verified in `SMARTLIFE_RESOURCES`/`SMARTLIFE_DETAIL_RESOURCES`/`SMARTLIFE_MISC_READ`, or newly verified live against the real API and cross-checked against the actual V3 spec text. If a module has no real endpoint, say so and move on — do not invent one.
- **No fake data, ever.** If a resource is permission-blocked or empty, show that state truthfully (`Permission Required` / `Endpoint Unavailable` / `Connection Error` / empty state). Never synthesize rows to make a screen look populated.
- **One canonical implementation per feature.** Before adding anything, search for whether it already exists. Do not create a second connector, a second invoice template, a second dashboard, a second sync engine, or a parallel route tree.
- **No design resets.** Accounting, Inventory, Projects, and QuotePro keep their current visual design, layout, navigation, and templates exactly as-is unless a specific functional requirement below needs a small, additive change (like adding a nav item, not restructuring the sidebar). CRM's dashboard may keep receiving professional-quality upgrades (KPIs, charts, panels) but must stay visually part of the same CRM, not a redesign.
- **Local edits stay local.** Anything a user edits inside our own apps (CRM contact, local quotation, local invoice, local project) writes only to our local database, is shared across apps that reference the same record, and is never sent to SmartLife.
- **Clean up after yourself.** Any diagnostic/probe script you create to verify a live API response must be deleted once you're done with it — or its logic migrated into a permanent file if it's genuinely needed long-term. Never leave a `_tmp-*`, `probe-*`, `diag-*`, or similarly-named file in the repo when you're done.

---

## 4. What to actually work on (in priority order)

SmartLife's own permission restriction (14 of 15 real business resources still 401) is the ceiling on how much "real data" work is possible right now — don't waste effort trying to route around it. Everything below is either (a) architecture that must be ready for when permissions are eventually granted, or (b) real, valuable work that doesn't depend on those permissions at all.

1. **Verify the environment fix holds** under normal `npm run dev` usage (not just the isolated app restarts used to diagnose it) — confirm both Accounting and CRM pick up `SMARTLIFE_*` vars correctly when started via the root dev workflow.
2. **Financial Reports / accounting-side depth**: the Accounts and Cost Centers modules currently render through the generic table view only. If you find real, verified detail/balance endpoints for these (`accounting/account_balances`, `accounting/get_entry/{id}` are already mapped) that aren't yet surfaced in a dedicated report view, wire them in — using the existing report template/PDF system (`apps/accounting/lib/reportPdf.js`), not a new one.
3. **CRM**: extend Customer-360 with whatever else the shared local tables can support today (outstanding receivables per customer, recent activity tied to a customer) without needing new SmartLife permissions — that data mostly already lives in `erp_financial_source_records`/`crm_timeline_events`.
4. **Inventory**: if there's a natural place to add a similar SmartLife-source read-only panel to Suppliers or Warehouses (mirroring the Products panel pattern), do it — but only if it adds real value, not just for coverage's sake.
5. **Cross-app consistency**: check whether local customer/product records are actually being shared consistently across CRM/Accounting/Projects/Quotation via `crm_record_mappings`/`crm_customer_identities`, or whether there are silent duplicate-record risks — fix data flow issues you find, don't rebuild the mapping system.
6. **Full regression pass**: after any change, re-run the existing test suite, rebuild each touched app, and — critically — hit the actual live HTTP routes (not just unit tests) for at least Sales Invoices, Purchase Invoices, Categories, and the CRM dashboard, the same way the last audit did, to prove the browser-facing path actually works end to end.

---

## 5. Working method

1. Inspect before touching anything.
2. Pick the highest-value item from the list above (or one you find during inspection that's genuinely more urgent) and finish it completely, including tests and a live HTTP check.
3. Move to the next item without stopping to ask permission for routine implementation decisions.
4. If you hit a SmartLife permission wall, implement everything possible around it, show the correct state, and move on — don't stop the whole session over one blocked module.
5. Before you finish, run the full audit checklist: no temp files, no duplicate connectors/routes/tables, no fake data, no SmartLife writes, tests green, builds green, designs preserved.

---

## 6. Final report format

When you're done, report:

1. Completed
2. Remaining
3. SmartLife modules with real data
4. SmartLife modules blocked by permissions
5. Modules without a verified endpoint (and therefore correctly not built)
6. Accounting status
7. CRM status
8. CRM dashboard status
9. Inventory status
10. Projects status
11. QuotePro status
12. Print/PDF status
13. Database changes (if any — and why they were genuinely necessary)
14. Files changed
15. Files removed (temporary/diagnostic)
16. Test results
17. Build results
18. Remaining external blockers (i.e., anything that requires SmartLife's side, not code)

Be exact. Don't say something is "complete" if it's actually blocked by SmartLife permissions — say so plainly.
