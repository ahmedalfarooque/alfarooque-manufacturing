# AL FAROOQUE ERP — Project Structure Guide

## Canonical project location

```
C:\Websites\alfarooque-manufacturing live
```

**Branch:** `main`. This is the ONE canonical project, ONE repository, ONE codebase for the entire AL FAROOQUE ERP.

**WORK ONLY IN THIS CANONICAL PROJECT.**
**DO NOT CREATE DUPLICATE WORKTREES, CLONES, PARALLEL PROJECTS, OR DUPLICATE IMPLEMENTATIONS.**

If a session's working directory is anywhere under `.claude/worktrees/**`, that is a per-session isolation copy some clients create automatically — it is NOT a second project. Before doing feature work, always target absolute paths under `C:\Websites\alfarooque-manufacturing live\...` for every read, edit, and git operation, regardless of what the shell's own `pwd` reports. Verify with `git -C "C:\Websites\alfarooque-manufacturing live" log --oneline -5` that your work is landing on `main` there. A stray `.claude/worktrees/*` directory left on disk from a prior session can be removed with `git worktree remove <path>` from a *different* session/terminal — never from inside the session whose cwd it is.

**Before editing any feature:** identify the active route/file/API/table and reuse the existing implementation. Search first (`Glob`/`Grep`), don't assume something is missing just because you haven't seen it yet.

## The six apps

| App | Directory | Port | Role |
|---|---|---|---|
| QuotePro | `apps/quotation` | — | **Primary reference** for shared-module UI/data model (Materials, Catalogue, Customers, Suppliers). Most mature app. |
| Projects | `apps/projects` | 3020 | **Secondary reference** when a shared module doesn't exist in QuotePro. |
| Cars | `apps/cars` | 3010 | Fleet/maintenance ERP. |
| Inventory | `apps/inventory` | 3040 | Newest app — warehouse/stock ERP. Least mature on i18n/theme parity; audit against QuotePro before assuming it's correct. |
| Accounting | `apps/accounting` | 3050 | Financial ERP + SmartLife data browser. |
| CRM | `apps/crm` | 3060 | Owns the central SmartLife connector route and cross-app record mapping tables. |

Each app is an independent Next.js app with its own `app/`, `lib/`, `components/`. Root `npm run dev` starts the main site + Cars/Projects/Quotation together — see root `CLAUDE.md` for the full port table and other apps' individual start commands (`apps/DEPLOYMENT.md`).

## `apps/shared/` — cross-app code

- `permissionRegistry.js` — the module/action registry for every app (`APPS`, `ROLES`, `MODULES`, `levelToActions`, `defaultPermission`, `moduleFromPath`). This is the single source of truth for what modules exist per app and what View Only / View & Edit / Full Access map to.
- `moduleAuthorization.js` — `authorizeRequest`/`getEffectivePermission`: resolves a user's real, per-module permission (override → saved role → role default) from `app_permissions` + `erp_role_permissions`. Every app's `lib/http.js` (`requireAction`/`requireDelete`) calls into this. **This is the one real security boundary — do not add a second one.** (Inventory previously had a redundant legacy `lib/perms.js` gate stacked after this that ignored per-module overrides — removed; if you find the same stacked-gate pattern elsewhere, remove the redundant layer, don't add another.)
- `UsersWorkspace.js`, `RolePermissionsEditor.js`, `ModuleActionVisibility.js` — shared Users/Roles/Permissions UI building blocks.
- `integrationPlatform.js` — the ONE canonical SmartLife/SmartERP connector (`readSmartLife`, `smartErpRequest`, `SMARTLIFE_RESOURCES`). Hard-enforces read-only (structurally rejects any non-GET call except the one login POST) and an allow-list of verified endpoints. **Never weaken this.** CRM's `app/api/integrations/smartlife/data/[resource]/route.js` is the only caller; every other app proxies through it (`apps/accounting/lib/smartlife.js`, `apps/inventory/lib/smartlife.js` — thin per-app proxies, intentional, do not replace with a direct connector).
- `financialRecords.js` — writes SmartLife-sourced rows into local snapshot tables (`erp_financial_source_records`) as new rows; never spreads SmartLife data over a local record, never nulls a local-only field.
- `dims.js` — shared material-dimension formatting (height/width/length/thickness + unit), used by Materials pages across apps.

## SmartLife integration rules

- SmartLife is **read-only**, always. The only allowed request is the login POST.
- Local edits (Add/Edit/Delete in our own apps) write only to our own tables, never to SmartLife.
- When refreshing SmartLife-owned fields (name, code, category, cost, price, tax, quantity, alert_quantity), never overwrite a local-only field (dimensions, waste %, notes, etc.) with null just because SmartLife doesn't provide it.
- SmartLife data is surfaced either live (`readSmartLife`) or via the local snapshot/mapping tables (`crm_record_mappings`, `crm_sync_records`, `erp_financial_source_records`) — never duplicated into a second ad-hoc cache.

## Master-data architecture

- `erp_master_data_mappings` — the intended canonical cross-system linking table (`canonical_table`, `canonical_id`, `source_system`, `source_record_id`, `match_method`). **Use it, do not recreate it** — but as of this writing it is an unpopulated scaffold (0 rows, unreferenced by any app code). Wiring real links into it requires a strong verified identifier (VAT, phone, exact code, an existing mapping) — never merge on name/description similarity alone. If uncertain, keep records separate.
- Today's actual (non-canonical) shared-data reality, verified by direct audit — know this before assuming anything is "the" master table:
  - **Materials**: QuotePro's `qt_materials` (~1,141 real rows) is the de facto canonical source. Inventory's `inv_materials` is empty and read-only-falls-back to `qt_materials` for display; local Inventory rows are separately editable once created.
  - **Products**: four distinct, currently-unlinked datasets — `qt_catalogue_products` (QuotePro's quotation cost templates, a different entity from a warehouse product), `inv_products` (Inventory's local table, empty, falls back read-only to the live SmartLife product feed), root-level `products` (15 rows — the public marketing website's showcase, NOT an ERP entity, never use as an ERP fallback), and SmartLife's live product feed (~2,912 items).
  - **Suppliers**: `qt_suppliers` (~269 rows) is the de facto canonical source; `inv_suppliers` empty, falls back read-only the same way as Materials.
  - **Customers**: root `customers` table (~287 rows) is actively shared by QuotePro, Projects, and CRM — genuinely canonical today. `qt_customers` (~262 rows) is dead/orphaned (no live route references it) with a confirmed 262/262 phone-number overlap with `customers` — a stale predecessor, not a distinct dataset. Don't resurrect it.
  - **Categories**: three real, independent, non-overlapping vocabularies (`inv_categories`, `qt_material_categories`, `maintenance_categories` in Cars) — this is correct, not a bug; they classify different things.
  - **Warehouses**: `inv_warehouses` exists but is empty across all three apps that reference it (Inventory, Accounting, Projects) — a real data gap, not a code bug. Don't fabricate rows.

## Report / PDF architecture

- Each app has its own `lib/reportPdf.js`, intended to be a byte-identical mirror across `quotation`/`projects`/`cars`/`inventory` (each file's own header comment states this). If you change one, back-port the same change to the others to keep the mirror contract — don't let them silently drift.
- QuotePro's separate document-PDF pipeline (`lib/pdf/renderPdfServer.js`, `arabicText.js`, `QuoteDocument.js`) and Accounting's `InvoiceDocument.js` + `lib/pdf/renderPdfServer.js` are intentionally separate systems for full documents (quotations/invoices), distinct from the generic list-report engine above. Don't merge them, don't create a third PDF engine.
- Every shared module's list view should offer View + Print + PDF at minimum, Add/Edit/Delete per the user's permission level. PDF/print output must follow the currently active language (Arabic renders RTL, right-aligned, via canvas-shaped text for correct bidi).

## Language, theme, responsive

- **English is default.** Arabic must be a complete translation (no raw/untranslated keys) with true RTL — mirrored layout (sidebar side, table/form direction), not just translated text. `apps/*/lib/i18n.js` per app; if a component calls `t('some.key')` that isn't defined in both the `en` and `ar` blocks, it silently renders the raw key — always cross-check call sites against the dictionary when adding a feature.
- **Dark is the default theme** (repo-wide convention, see root `CLAUDE.md`) — light is opt-in. Both themes must stay equally functional and readable; theming is driven by CSS custom properties in `themes.css`/`globals.css`, not scattered `dark:` Tailwind classes.
- Every list page must wrap its `<table>` in a horizontally-scrollable container (`overflow-x-auto`); the page itself must never overflow horizontally. Modals must fit small screens.

## Permissions model

Seven roles (`admin, manager, sales, estimator, accountant, production, readonly`), three access levels per module:

- **View Only** = view + print + PDF
- **View & Edit** = + edit
- **Full Access** = + add + delete
- **Admin** = full access to everything

Enforced identically at UI and server level through `apps/shared/moduleAuthorization.js`. A new module/action must be registered in `apps/shared/permissionRegistry.js` — never build a second, app-local permission system on top of it.
