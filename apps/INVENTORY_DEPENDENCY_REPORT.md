# Inventory & Warehouse ERP — Pre-Build Dependency Report

**Date:** 2026-07-29 · **Branch:** `claude/erp-modules-structure-a1hktp`
**Status:** Repository scanned. **No files created yet.** Five decisions needed before scaffolding (§7).

---

## 1. Verification results (what was actually tested)

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | Repository scan | ✅ Complete | 483 JS/JSX source files across 3 apps + root site |
| 2 | Existing apps build | ✅ **All 3 pass** | `next build` run on `cars`, `projects`, `quotation` — all completed, routes emitted |
| 3 | Shared authentication | ✅ Verified (code) | `lib/auth.js` per app; JWT + bcrypt + OTP; shared `platform_users` table |
| 4 | Shared SSO | ⚠️ Verified — **admin-only** | `lib/sso.js` byte-identical in all 3 apps (md5 `be160df1…`) |
| 5 | Shared middleware | ✅ Verified | `middleware.js` per app, Edge runtime via `jose` |
| 6 | Shared UI | ✅ Verified | `glass.js` (20 exports) + `ui.js` (11 exports) + `Shell.js` |
| 7 | Supabase connection | ⛔ **Cannot verify** | **No `.env` file exists.** Supabase MCP connector is unauthenticated |
| 8 | App Switcher | ⚠️ Verified — **admin-only, hardcoded** | `AppSwitcherButtons.js`, `lib/appLinks.js` |
| 9 | Database schema | ✅ Verified (files) | 26 `.sql` files in `/supabase`; no live DB introspection possible |
| 10 | Reusable components | ✅ Catalogued | See §3 |

**Additional infrastructure findings:**

| Item | Expected | Actual |
|------|----------|--------|
| TypeScript | Requested "same TS config" | ⛔ **No TypeScript exists.** 0 source `.ts/.tsx`, no `tsconfig.json`. All 483 files are JS. The 75 `.ts` files found are Next.js build artifacts in `.next/types/` |
| ESLint | "Run lint" after each feature | ⛔ **Not configured.** `npx next lint` opens an interactive setup prompt; no `.eslintrc` in any app |
| Tests | "Run tests" after each feature | ⛔ **No test framework, 0 test files.** No jest/vitest/playwright dependency, no `"test"` script in any `package.json` |
| Supabase Realtime | "Configure Realtime" | ⛔ **Not used anywhere today.** All live data is HTTP polling via `lib/useLiveData.js`, whose header comment states *"Polling today, Realtime-ready tomorrow"* |

---

## 2. Stack (what Inventory must match)

```
Next.js  14.2.15  (App Router)      React 18.3.1        Tailwind 3.4.13
@supabase/supabase-js 2.45.4        jsonwebtoken 9.0.2  jose 5.9.6
bcryptjs 2.4.3                      recharts 2.12.7     clsx 2.1.1
exceljs 4.4.0                       jspdf 2.5.2 + autotable 3.8.4
Language: JavaScript (ESM/CJS mix)  ·  Path alias: @/* via jsconfig.json
```

---

## 3. Reuse inventory — copy verbatim (no new code)

These files are **byte-identical across all 3 apps today** (verified by md5). The established convention is deliberate mirroring, because each app is a separate Vercel project with its own Root Directory — there is no npm workspace or shared package.

| File | md5 | Reuse |
|------|-----|-------|
| `lib/sso.js` | `be160df1bcc617cfe90b19b774b62659` | Copy + **must edit** (§5) |
| `lib/appLinks.js` | `3c80fea410072f82dac87d925a2d906f` | Copy + **must edit** (§5) |
| `lib/prefs.js` | `5fb43834ebcaf39705b5ecbb23a0af7e` | Copy as-is |
| `lib/useSortableData.js` | `f2bf33d33d9dca43ff9ca018aab4555f` | Copy as-is |
| `lib/useDebouncedValue.js` | `ccb2ff694f534a8382a16f4c2823f975` | Copy as-is |
| `lib/reportPdf.js` | `c5e15fe543d21b6a2b5ecb6b03a434c8` | Copy as-is |
| `lib/db.js` (projects/cars variant) | `5758430384bfc251304d32191d9f8793` | Copy as-is |
| `lib/useLiveData.js` | `4e41ff2c992cba4eb208982176469f99` | Copy as-is (or upgrade to Realtime — §7·E) |

**Adapt per-app (same shape, app-specific constants):**
`lib/auth.js` (change `APP`/`COOKIE_NAME`), `middleware.js` (cookie name + route guards),
`lib/i18n.js` (EN/AR strings), `lib/http.js`, `components/Shell.js` (NAV array),
`lib/superAdmin.js`, `lib/email.js`.

**UI components — copy as-is (zero new design work):**
- `components/glass.js` — `GlassCard`, `GlassButton`, `GlassInput`, `GlassSelect`, `GlassModal`, `GlassBadge`, `GlassTabs`, `GlassToolbar`, `GlassSkeleton`, `GlassPagination`, `GlassEmptyState`, `toast()`, `GlassToastHost`, `CHART_COLORS`, `chartTheme`, `IconTile`
- `components/ui.js` — `Button`, `IconButton`, `Input`, `Textarea`, `Select`, `Field`, `Modal`, `EmptyState`, `Th`, `Td`, `Pagination`
- `components/StatCard.js`, `MiniBarChart.js`, `ProgressRing.js`, `TrendLine.js`, `GlassIcons.js`, `Dropdown.js`, `AppSwitcherButtons.js`
- `tailwind.config.js` (cyan `brand-*` scale), `postcss.config.js`, `jsconfig.json`, `next.config.js`

**Config to clone:** `.gitignore`, `vercel.json`, `package.json` (change name + port)

**Reuse estimate: ~85% of the app shell is copy/adapt. New code is confined to Inventory domain logic, pages, APIs, and schema.**

---

## 4. Database — current state

- **One Supabase project**, service-role key server-side only (`lib/db.js`)
- **Prefixes in use:** `qt_` (QuotePro), `pm_` (Projects), `car_` (Cars), unprefixed (public site: `products`, `orders`, `profiles`)
- **`inv_` prefix is unused** ✅ — no collision for the 17 Phase-1 tables
- Identity: `platform_users` (shared), `platform_login_attempts`, `platform_sessions`, `otp_codes`
- Convention: additive versioned migrations only — `supabase/<prefix>-schema-vNN-<what>.sql`

⚠️ **All schema knowledge above is read from `.sql` files, not from the live database.** Without `.env` or an authenticated Supabase connector I cannot confirm the deployed schema matches these files, nor detect drift.

---

## 5. Files in existing apps that MUST change to add Inventory

Adding an app to the switcher is **not** additive — the architecture doc (`ERP_STRUCTURE.md` §2·B steps 2–3) mandates these edits, and they touch all three shipped apps:

| File | Change | Copies to update |
|------|--------|------------------|
| `lib/appLinks.js` | Add `{ id:'inventory', sub:'store', port:3050 }` to `APPS` + `ENV_URLS` | 3 existing + 1 new = **4** |
| `lib/sso.js` | Add `af_inventory_session` to `APP_COOKIE_NAMES` (else admin logout-everywhere leaves an Inventory session alive) | **4** |
| `components/AppSwitcherButtons.js` | Add to `ORDER` + `LABELS` (EN/AR) | **4** |
| `apps/ERP_STRUCTURE.md` | Update reserved subdomain/port/prefix table | 1 |

This is a deliberate, minimal, additive-only exception to "do not modify unrelated modules" — without it the switcher and logout are broken. **Nothing else in the existing apps is touched.**

---

## 6. Cross-app integration feasibility (Phase 1 scope check)

| Integration | Feasible now? | Note |
|-------------|---------------|------|
| Quotation reads stock on material select | ✅ | `qt_materials.id` → `inv_products.qt_material_id`; read-only API |
| Projects request materials | ✅ | `pm_purchase_requests` already exists → link via `inv_purchase_requests.pm_request_id` |
| Cars spare parts | ✅ | `car_maintenance` → `inv_stock_movements` reference |
| Website read-only availability | ✅ | `products.id` → `inv_products.product_id`; **read-only, never writes** |

All four link **by row ID**, matching the existing shared-customers convention. No data duplication.

---

## 7. Decisions needed before I scaffold

**A. Port & domain collision** — `ERP_STRUCTURE.md` §4 (committed) reserves:
- Inventory & Warehouse → `inv.alfarooque.com`, port **3040**, prefix `inv_`
- Production / MRP → `production.alfarooque.com`, port **3050**, prefix `mfg_`

You asked for port **3050** + `store.alfarooque.com`. That takes Production/MRP's reserved port.
→ **Use `store` + 3050 as you specified and reassign Production/MRP to 3040?** (I'd update the reserved table to keep it authoritative.) Or keep the doc's `inv` + 3040?

**B. TypeScript** — you asked for "same TypeScript configuration"; the codebase has none. Match the existing JavaScript (recommended — consistent, zero migration risk), or introduce TS for Inventory only (creates a two-language monorepo)?

**C. Roles** — you listed 9 roles (Super Admin, Admin, Warehouse Manager, Store Keeper, Purchasing, Finance, Project Manager, Sales, Viewer). `platform_users.role` supports only `admin | viewer`. QuotePro solved this with a per-app table + helper (`qt_user_roles` + `lib/perms.js`).
→ Mirror that pattern as `inv_user_roles` + `lib/perms.js` (recommended, additive, doesn't touch shared identity)?

**D. Single sign-on for non-admins** — SSO cross-app is **admin-only by design** (`verifySsoSession` rejects any non-admin payload; middleware enforces the same). So "already logged in → Inventory opens without logging in again" holds for admins/super-admin, but a Warehouse Manager or Store Keeper **will** hit the Inventory login page.
→ Accept admin-only SSO (recommended for Phase 1 — extending SSO to all roles is a security change affecting all 4 apps)? Or extend SSO to all roles as a separate, deliberate piece of work?

**E. Realtime** — no Supabase Realtime exists anywhere; today everything polls via `useLiveData`. Building Realtime for Inventory means writing it fresh (and enabling replication per table in the Supabase dashboard, which I can't do without credentials).
→ Ship Phase 1 on the proven polling helper and add Realtime as a focused follow-up, or build Realtime now in Inventory only?

**F. Environment access** — with no `.env` and no authenticated Supabase connector, I can write migrations but cannot apply or verify them, cannot run the app against real data, and cannot enable Realtime replication. To authorize the Supabase connector, use your claude.ai connector settings (this session is non-interactive, so I can't run the OAuth flow here).

---

## 8. Proposed Phase 1 plan (pending §7 answers)

1. Scaffold `apps/inventory` from `apps/cars` (smallest app) — config, shell, auth, middleware, UI
2. Register Inventory in `appLinks.js` / `sso.js` / `AppSwitcherButtons.js` × 4 copies
3. Write `supabase/inv-schema.sql` — 17 Phase-1 tables, RLS on, additive only
4. Build APIs under `app/api/*` following the existing route conventions
5. Build the 14 pages using the existing Glass component library
6. Add `inv_user_roles` + `lib/perms.js`
7. Wire the 4 cross-app read integrations
8. Verify: `next build` per change; ESLint/tests only if you want them introduced (§1)
9. Commit + push to the feature branch

**Also still open from earlier:** the business-card deploy decision — whether to merge only the card commits to `main`, or the whole branch (which also carries the Projects/Cars/Quotation glassmorphism redesign). Nothing has been merged.
