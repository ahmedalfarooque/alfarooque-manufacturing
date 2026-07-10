# Claude_Code_Implementation_Prompt.md
## Build Instructions: Al Farooque Enterprise Quotation & Cost Estimation System
**Target:** quotation.alfarooque.com · **Companion document (authoritative spec):** `Quotation System Master Specification.md` (v1.0)

---

## 0. Your Role and Prime Directives

You are Claude Code, acting as the senior full-stack engineer implementing an approved specification. You do not redesign; you build.

1. **The spec is law.** `Quotation System Master Specification.md` is the single source of truth. Read it fully before Phase 0. If the spec and this prompt ever conflict, the spec wins. If something is genuinely ambiguous, choose the simplest option consistent with the spec, implement it, and record the decision in `docs/DECISIONS.md` — do not stall.
2. **Match the existing Al Farooque codebase.** Before writing any code, study the repos for cars.alfarooque.com and projects.alfarooque.com (provided locally / on GitHub). Reuse their: Tailwind config and design tokens, UI primitives, Supabase client/server/middleware patterns, auth flow, ESLint/Prettier/tsconfig settings, folder conventions, and Resend email setup. The new app must look and feel like a sibling of those apps, not a stranger.
3. **Stack (fixed):** Next.js (App Router) · React · TypeScript strict · Tailwind CSS · Supabase (PostgreSQL, Auth, Storage, Edge Functions, Realtime, pg_cron) · GitHub · Vercel · Resend. Add only these libraries: TanStack Query, TanStack Table, Zustand, Zod, React Hook Form, next-intl, @react-pdf/renderer, SheetJS (xlsx), Recharts (or the chart lib already used in existing apps), Sentry. Anything else requires a note in `docs/DECISIONS.md`.
4. **Phase discipline.** Work strictly in the phases below. Each phase must end: code complete → tests passing → lint/typecheck clean → migration applied to staging → conventional-commit(s) pushed → short phase report appended to `docs/PROGRESS.md`. Never start phase N+1 with phase N red.
5. **Non-negotiable invariants** (enforce in DB, API, and UI):
   - Snapshot rule (spec §9.3 / BR-4): quotation lines copy master data; masters never mutated by quotes, quotes never mutated by master edits.
   - Immutability: quotations with status ≥ `approved` reject edits except whitelisted transitions (spec FR-QUO-5, §17).
   - Cost confidentiality: cost/margin never reaches clients lacking `costs.view` — strip at RLS/view/API layer, not just UI (BR-9).
   - VAT 15% default, SAR, 2-dp money, line-level rounding then sum (spec §9).
   - Per-entity numbering `{PREFIX}-{YYYY}-{SEQ}`, revisions `-Rn` (BR-3), race-safe.
   - Soft delete + audit trigger on every business table.
   - Full bilingual EN/AR UI with RTL from Phase 0 onward — never bolt on later.
6. **Testing bar:** the costing engine (`lib/costing`) is pure TS with 100% branch coverage against the worked examples you must derive from spec §9 (include the inverse-selling-price mode). Playwright e2e smoke per phase. UAT parity: totals of recreated real quotations must match Excel to the halala.
7. **Security bar:** RLS default-deny on all tables from the first migration; service-role key server-only; every route Zod-validated; follow spec §17 checklist before Phase 6 exit.

---

## 1. Environments & Setup (do once, in Phase 0)

- GitHub repo `quotation-app` (org standards: branch protection on `main`, PR checks: lint, typecheck, unit, build).
- Branches: `main` → Vercel prod (quotation.alfarooque.com), `develop` → staging preview; feature branches `feat/p{N}-{slug}`.
- Supabase projects `quotation-prod` and `quotation-staging`; migrations via Supabase CLI, committed under `supabase/migrations/`; staging auto-applied in CI, prod applied manually per release.
- Env vars per spec §19; `.env.example` maintained; Sentry DSNs both environments.
- Seed script (`supabase/seed/`): entities (WW, IAAE with real CR/VAT/branding placeholders), roles + permissions matrix (spec §13), default settings (profit defaults, approval thresholds: 50,000 SAR / 15% margin / 10% discount), units, material & expense categories, terms templates.

---

## 2. Implementation Phases

### Phase 0 — Foundation & Shell
**Build:** repo scaffold mirroring existing apps; CI pipeline; auth (Supabase, middleware-protected `(app)` group); app shell — sidebar (spec §6.1), topbar, theme toggle (dark mode), language toggle (next-intl EN/AR, full RTL mirroring, `IBM Plex Sans Arabic`), command-palette shell (Ctrl+K, empty providers); profiles table + RBAC tables + `has_perm()` SQL helper + base RLS; audit-trigger function; error/404 pages; Sentry.
**Done when:** user can log in, switch EN↔AR (layout mirrors), switch dark/light, see an empty dashboard on staging. `docs/PROGRESS.md` started.

### Phase 1 — Master Data
**Build (spec §3.1.1–3.1.7, §7.6–7.11, §11):** migrations + CRUD + list/detail screens for Customers (+contacts, merge), Suppliers, Projects (table + kanban), Material categories (tree), Materials & Hardware (all fields incl. barcode, waste %, certification, attachments), material price history + supplier history, Labour roles (+rate history), Machines, Expense templates. Generic `DataTable` (server pagination, filters, saved views, bulk-edit bar), trigram search RPC (Arabic-aware), favorites & recents, attachments (Supabase Storage, drag-drop). Importers: Customers (WW-03 Customer Details format) and Purchases Report (per spec §21.1) as background `import_jobs` with dry-run validation and error-file download.
**Done when:** both real Excel files import cleanly on staging (≈280 customers; 2,421 purchase lines → materials + price history + suppliers); material smart-search returns ranked results < 150 ms; audit rows written for every mutation.

### Phase 2 — Catalogue & Costing Engine
**Build (spec §3.1.8, §9, §7.8):** `lib/costing` pure engine implementing every formula in spec §9 (sections, waste, overhead→risk→profit, rounding rules, inverse mode, quotation-level math) with exhaustive unit tests; `catalogue_products` + `product_cost_lines` migrations; Product detail screen with six-tab Cost Model editor (Materials | Hardware | Labour | Machines | Expenses | Other) using the snapshot-picker pattern; Cost Summary card; Recost with old→new diff preview; duplicate product; catalogue price history; Standard Price List importer.
**Done when:** a hand-built product costing in the app matches a hand-calculated Excel check exactly; recost diff works; engine coverage report ≥ 100% branches.

### Phase 3 — Quotation Core
**Build (spec §3.1.9 except approvals/send, §7.4):** quotations + quotation_products + qp_cost_lines migrations with `recalc_quotation` RPC and status-guard trigger; race-safe `next_quote_number`; Quotation editor: header (entity/customer/project/dates/output language), Add Product (From Catalogue | Detailed | Duplicate), inline six-tab cost editor reusing Phase-2 components, `/` material picker (favorites/recents/search, keyboard-first), sticky summary panel (Subtotal → Discount → Net → VAT → Grand Total + internal blended cost/margin), line reorder, multi-line descriptions; Zustand editor store + undo; autosave (3 s debounce, version-conflict 409 banner); draft recovery; duplicate quotation; revisions (`-Rn`, supersede, compare view); attachments; quotations list with tabs/filters/saved views.
**Done when:** full draft→auto-approve lifecycle works with correct numbering; client totals always equal server `recalc_quotation` output; two-user conflict handled gracefully.

### Phase 4 — Approval, PDF, Send
**Build (spec BR-7, FR-QUO-5/9/10/11, §7.5):** threshold engine reading settings; submit → pending_approval routing; Approvals screen + notifications (in-app + email via Resend); approve/reject with reasons; PDF generation (@react-pdf/renderer, per-entity letterhead, AR and EN layouts with correct RTL shaping, multi-line details, totals block, T&C, signature, page numbers, optional images, QR to public view); PDF preview screen with options; send via Resend (templates, log every send in quotation_events); public read-only `/q/[token]` (no costs/internal notes, rate-limited); expiry cron (pg_cron) → expired status + follow-up notifications; accept/reject with win/loss reasons.
**Done when:** end-to-end demo — create → submit → approve on another account → PDF in Arabic and English both render correctly → email received with attachment → public link works → expiry cron verified on staging.

### Phase 5 — Dashboards & Reports
**Build (spec §8, FR-RPT):** dashboard KPI cards (role-sensitive, `mv_dashboard_stats` materialized view + cron refresh), pipeline funnel, 12-month quoted-vs-accepted chart, my-tasks / activity / price-alert cards; Analytics boards (Sales, Margin, Materials, Customers); Reports module: quotation register, win-rate, margin analysis, material price movement, VAT summary per entity/period, customer statement — each with filter panel + xlsx/pdf export (cost columns stripped without `costs.view`).
**Done when:** all reports reconcile against direct SQL spot-checks; dashboard loads < 2.5 s on staging data.

### Phase 6 — Admin, Hardening, Polish
**Build (spec §3.1.11–3.1.12, §17, §18, §20):** Users & Roles screens (invite, permission matrix, entity access); Settings screens (Entities/branding/numbering/T&C, VAT, Profit & thresholds, Units & Categories, Email templates, Language); Audit log viewer with JSON diff; Activity feeds; Import/Export centre; Notifications page + preferences; Profile; global search providers completed (quotations/customers/products/materials/projects/suppliers); full keyboard-shortcut map (spec §7.14) + `?` overlay; bulk editing everywhere; rate limiting (auth/search/public); RLS audit pass — write a test that enumerates tables and asserts RLS enabled + default deny; off-platform backup GitHub Action (weekly pg_dump, encrypted) + restore runbook `docs/RESTORE.md`; performance pass to budgets (spec §20: editor route < 350 kB gz, Lighthouse CI check).
**Done when:** spec §17 security checklist ticked line-by-line in `docs/SECURITY_REVIEW.md`; a staging restore drill from backup succeeds.

### Phase 7 — Migration, UAT, Go-Live
**Do (spec §21.3):** run seed + imports against prod in the specified order; manually enter labour/machine rates with client; recreate 5 real quotations (e.g. 2011 Agave tables, 2013 fire doors, 862 series) and verify totals match the Excel/PDF originals to the halala; 2-week parallel-run support fixes; training notes `docs/USER_GUIDE.md` (EN + AR outline); DNS cutover to quotation.alfarooque.com; tag `v1.0.0`.
**Done when:** the client signs off UAT parity and go-live checklist in `docs/GOLIVE.md`.

---

## 3. Working Rules Per Session

- Start every session: read `docs/PROGRESS.md`, `docs/DECISIONS.md`, current phase section of this prompt, and relevant spec sections. Then continue where the progress log left off.
- Conventional commits (`feat(quotations): …`, `fix(costing): …`); small, reviewable PRs into `develop`; one PR may not span phases.
- Migrations are append-only once merged; never edit an applied migration.
- Generate DB types (`supabase gen types`) after each migration; no `any`, no `@ts-ignore` without a linked TODO.
- Every screen you build must work in both languages and both themes before it counts as done.
- When you finish a phase, output: what was built, migrations added, test results, known gaps, and the exact next step — then wait for approval to proceed to the next phase.

**Begin now with Phase 0.** First actions: clone and study the two existing app repos, produce a one-page conformance note (`docs/STACK_CONFORMANCE.md`) listing the exact conventions you will inherit, then scaffold the repo.
