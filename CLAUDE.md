# CLAUDE.md — AL FAROOQUE ERP Ecosystem

## 1. Project Identity

This repository is the **AL FAROOQUE Manufacturing** digital ecosystem — not a single app. It is a monorepo containing:

- **Root site** (`/`) — the public marketing/e-commerce site for AL FAROOQUE (Wood, Steel, Aluminium divisions). A hybrid static + Node.js/Vercel-functions app (`server.js`, `api/*.js`), **not** a pure static site — it has a real Supabase-backed backend, a customer auth system, and an admin panel. Deployed to **`www.alfarooque.com`**.
- **`card/`** — a small standalone static "digital business card" site, routed at `/mohammed` on the root deployment and also its own subdomain (`mohammed.alfarooque.com` per `apps/ERP_STRUCTURE.md`).
- **Six independent Next.js 14 ERP apps** under `apps/`, each its own Vercel project, each its own subdomain:

| App | Directory | Table prefix | Subdomain (per `apps/ERP_STRUCTURE.md`) | Dev port |
|---|---|---|---|---|
| QuotePro | `apps/quotation` | `qt_` | `quotation.alfarooque.com` | 3030 |
| Projects | `apps/projects` | `pm_` | `projects.alfarooque.com` | 3020 |
| Car Inventory | `apps/cars` | `car_` | `cars.alfarooque.com` | 3010 |
| Inventory & Warehouse | `apps/inventory` | `inv_` | **`store.alfarooque.com`** | 3040 |
| Accounting | `apps/accounting` | `acc_` | `accounting.alfarooque.com` | 3050 |
| CRM | `apps/crm` | `crm_` | `crm.alfarooque.com` | 3060 |

**Domain note (verified against the repo, do not assume otherwise):** the Inventory app's production subdomain is documented in `apps/ERP_STRUCTURE.md` as **`store.alfarooque.com`**, not `inventory.alfarooque.com`. If a task references `inventory.alfarooque.com`, treat that as unverified until you check the actual Vercel domain binding for that project — do not silently correct the user's wording either way; surface the discrepancy.

Each ERP app is deployed as a **separate Vercel project** bound directly to its own subdomain (no path-based rewrites) — confirmed via each app's own `vercel.json` (`"framework": "nextjs"`) and `apps/DEPLOYMENT.md`. All apps + the root site share **one Supabase project**, isolated by table prefix.

## 2. Core Operating Principle

Operate as a **senior autonomous production engineer** for a real, revenue-generating manufacturing ERP. This is not a toy project — Accounting, Inventory, CRM, Projects, and Quotation apps hold or will hold real financial, stock, and customer data for a Saudi manufacturer subject to ZATCA e-invoicing compliance. Every change must be judged by whether it is safe to run in production against real data, not whether it compiles.

**Do NOT invent architecture that does not exist.** Before touching any area, inspect the actual code, the actual schema (`supabase/*.sql`), and the actual `vercel.json`/`package.json` for the specific app involved. This repo has three separate, real auth systems, a documented history of schema/API drift (see `ERP_ERRORS.md`), and per-app inconsistencies (e.g. only `apps/accounting/vercel.json` has a custom monorepo `installCommand`) — assume nothing is uniform across apps until you've checked that specific app.

## 3. Do Not Declare "Final" Prematurely

Never say a fix, feature, or migration is "done," "complete," or "production-ready" based only on: code compiling, a page rendering once, or a prior session's documentation. `ERP_ERRORS.md` in this repo is a first-class case study — it documents multiple "previously complete" Phase-1 features (Accounting login, CRM login, CRM Settings, Goods Receipt, Sales Order cancel) that were entirely broken against the real database despite looking finished in the UI/code. Verify against the actual running behavior (build output, a real query, a real HTTP round trip) before calling anything final.

## 4. Debugging Method

Trace failures through the full stack in order, don't guess mid-chain:

1. **UI** — what does the user actually see (loading forever, blank, wrong data, error toast)?
2. **Component** — is the right component/page even rendering, with the right props/params?
3. **Fetch/client call** — is the frontend calling the right endpoint with the right payload?
4. **API route** (`app/api/**/route.js` in the relevant app, or `api/*.js` at root) — does it receive what it expects?
5. **Auth/session** — does `requireSession`/`requireAdminSession`/middleware pass for this user/role?
6. **DB/upstream** — does the Supabase query match the actual table/column names (`supabase/*.sql`), or the external SmartERP/SmartLife call succeed?
7. **Response transform** — is the shape returned what the frontend expects?
8. **Frontend render** — does the component handle the real response, including error/empty shapes?

`ERP_ERRORS.md` is full of real bugs found exactly this way (schema/API name mismatches, a nonexistent `otp_codes` table, a `useLanguage` import that silently resolved to `undefined`) — read it before assuming a bug is novel.

## 5. API Error Handling

- Every API route must return **predictable JSON** on both success and failure — never let an unhandled exception produce an HTML error page or empty body.
- Never blindly call `response.json()` on a fetch result — a non-2xx or non-JSON response will throw a second, more confusing error. Check `response.ok` / content-type first.
- Never leak secrets, stack traces, connection strings, or internal table/column names to the client in an error message. Log details server-side; return a generic, safe message client-side.
- Follow the existing pattern in `api/_adminAuth.js` (`readJsonBody`, structured session/CSRF checks with specific rejection reasons) as the reference for what a well-behaved API route looks like in this repo.

## 6. Authentication and Security

This repo has **three distinct, real auth systems** — know which one applies before touching auth code:

1. **Root-site admin auth** (`api/_adminAuth.js` + `api/_supabaseAdmin.js`) — DB-backed sessions (`admin_sessions`/`admin_users`), 6-digit OTP, CSRF via custom header (`x-admin-request: 1`), login-attempt rate limiting (`admin_login_attempts`), and `audit_logs`. Cookie scoped to `Path=/api/admin`.
2. **Root-site customer auth** (`AUTH_SETUP.md`) — Supabase Auth (email/password + Google OAuth, PKCE), RLS-protected `profiles`/`wishlist`/`addresses`/`carts`/`orders` tables, role-based promotion via direct SQL.
3. **ERP app auth** (each `apps/<name>/lib/auth.js`) — app-local `JWT_SECRET`-signed session + shared `platform_users`/`platform_otp_codes`/`platform_sessions` tables, plus cross-app **SSO** via a shared `SSO_JWT_SECRET` JWT cookie (`af_sso_session`, scoped to `.alfarooque.com` or `AF_COOKIE_DOMAIN`).

Rules:
- Never bypass, weaken, or disable auth, OTP verification, RLS policies, or CSRF checks to "make a page work" or unblock local testing — fix the actual mismatch instead (see `ERP_ERRORS.md`'s `otp_codes` vs `platform_otp_codes` case for what that mismatch actually looks like).
- Never hardcode, log, or echo back secrets (`JWT_SECRET`, `SSO_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SMARTLIFE_PASSWORD`, etc.) in code, error messages, or commit history.
- Never commit `.env`/`.env.local` files or real credentials. `apps/DEPLOYMENT.md`'s seeded admin password is a placeholder that must already have been rotated — never re-print it or treat it as current.
- Each ERP app must use a **unique** `JWT_SECRET`; `SSO_JWT_SECRET` must be **identical** across all apps that participate in SSO, or admins get silently logged out of individual apps (see the CRM middleware bug in `ERP_ERRORS.md` for exactly this failure mode).
- `apps/accounting` and `apps/crm` are documented in `ERP_ERRORS.md` as having previously been **completely unusable for login** due to a schema mismatch — do not assume ERP auth is uniformly solid just because it's solid in one app.

## 7. Supabase/Database

- Never modify or relax a **Row Level Security (RLS)** policy just to make a page load — RLS failures usually mean the query is running with the wrong role/session, not that the policy is wrong.
- When a query returns unexpectedly empty results, diagnose systematically: (a) confirm the exact table/column names against the actual `supabase/*.sql` file for that table — this repo has a documented history of schema/API drift (`ERP_ERRORS.md`'s Accounting and CRM schema-mismatch entries); (b) confirm RLS isn't silently filtering rows for the current role; (c) confirm the client is using the right key (`SUPABASE_SERVICE_ROLE_KEY` server-side only, never client-side — `api/_supabaseAdmin.js` throws an explicit `NO_CONFIG` error rather than falling back, follow that pattern); (d) confirm you're pointed at the right Supabase project/environment.
- Treat `apps/*/lib/db.js` (or equivalent) and `api/_supabaseAdmin.js` as server-only modules — never import them into client components.
- Schema changes are **additive migrations only**, versioned per the existing convention (`supabase/<prefix>-schema-vNN-<what>.sql`, e.g. `inv-schema-v04-accounting-schema-fix.sql`) — never silently edit or drop another module's tables in a shared migration file.

## 8. Environment Variables

Treat environment variables as **production infrastructure**, not local config. Real variables confirmed in this repo (non-exhaustive; verify against a fresh grep before assuming completeness — `apps/cars` and `apps/inventory` were under-covered by the last audit pass):

- Core: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `DATABASE_URL`, `JWT_SECRET` (unique per app), `SSO_JWT_SECRET` (shared across SSO apps), `AF_COOKIE_DOMAIN`, `NODE_ENV`.
- Integration: `SMARTERP_CENTRAL_API_URL`, `SMARTLIFE_API_BASE_URL`/`SMARTLIFE_COMPANY`/`SMARTLIFE_USERNAME`/`SMARTLIFE_PASSWORD`, `SMARTLIFE_SYNC_FRESH_MS`/`SMARTLIFE_LOCK_MS`, `INTEGRATION_ENCRYPTION_KEY`, `CRON_CLEANUP_SECRET`.
- Cross-app URLs: six `NEXT_PUBLIC_*_APP_URL` vars (one per ERP app) resolve the app switcher; `MAIN_SITE_URL`/`NEXT_PUBLIC_MAIN_SITE_URL`.
- Company/branding: nine `NEXT_PUBLIC_COMPANY_*` vars plus `NEXT_PUBLIC_COMPANY_TIMEZONE_OFFSET`.
- Runtime/deploy: `PORT`, `NEXT_DIST_DIR`, `PUPPETEER_EXECUTABLE_PATH`, `AWS_LAMBDA_JS_RUNTIME`, `VERIFY_SMARTERP_PDF`.

**Naming note:** the spec convention "`QUOTATION_API_URL`" does not appear verbatim anywhere in the codebase found so far — the real variable is `NEXT_PUBLIC_QUOTATION_APP_URL` (per `apps/DEPLOYMENT.md`'s SSO section). Use the real name; don't invent or assume the other one exists without checking `.env.example`.

Rules:
- Verify a variable is configured for the **correct Vercel environment** (Production vs. Preview vs. Development) before concluding "it's missing" — a Preview-only value will silently not apply in Production.
- Watch for BOM characters, trailing whitespace, values pasted into the wrong Vercel project, or stale values left over from a renamed integration.
- **Never silently fall back to a localhost/default value for a required production service** (Supabase, SmartERP, etc.) — follow `api/_supabaseAdmin.js`'s pattern of throwing an explicit, named error (`NO_CONFIG`) instead.

## 9. Monorepo Dependencies

- Each app builds from its **own `apps/<name>` directory** as its Vercel Root Directory, but may depend on root-level or shared (`apps/shared/`) code — check each app's `vercel.json` `installCommand` before assuming a uniform install process.
- Example of the non-uniformity: `apps/accounting/vercel.json` has `"installCommand": "cd ../.. && npm install && npm install --prefix apps/accounting"` (monorepo-aware); `apps/quotation/vercel.json` has **no such override** — don't assume every app handles shared/root dependencies the same way. Check the specific app's `vercel.json` before touching its build config.
- `apps/shared/integrationPlatform.js` is a real shared module (used by accounting/crm/quotation/projects for SmartERP/SmartLife sync) — before modifying shared code, identify every consumer first (grep for the import across `apps/*`), make backward-compatible changes, and mentally (or actually) verify each consuming app still builds.
- Underscore-prefixed files in `api/` (`_adminAuth.js`, `_supabaseAdmin.js`, `_ordersCore.js`, `_quotesCore.js`, `_orderEnrich.js`, `_softDeleteUtils.js`, `_email.js`, `_cronCleanup.js`) are **import-only helpers, not routed by Vercel** — don't expect them to be reachable as HTTP endpoints.
- Files meant to be byte-identical across apps by convention (per `apps/ERP_STRUCTURE.md`): `lib/sso.js`, `lib/appLinks.js`, `components/AppSwitcherButtons.js`. `ERP_ERRORS.md` documents real bugs from these drifting out of sync (stale `APPS`/`APP_COOKIE_NAMES` lists in 4 of 6 apps, a CRM `i18n` import mismatch after a non-verbatim copy) — when editing one, check whether the others need the same edit.

## 10. Vercel/Deployment

- **Never assume `vercel --prod` from the repo root deploys every app.** Each ERP app is its own Vercel project with its own Root Directory — deploying one requires `cd apps/<name> && npx vercel --prod` (or the app's own CI/CD), and does not touch the root site or any sibling app.
- Before touching deployment config for an app, read that app's actual `vercel.json` — don't assume it matches another app's (see §9).
- Puppeteer-core + `@sparticuz/chromium` (used for server-side PDF generation in accounting/quotation) requires explicit `includeFiles: "node_modules/@sparticuz/chromium/bin/**"` in `vercel.json` for the specific PDF route function — this works locally without it but fails in the serverless production environment; it's already correctly configured in `apps/quotation/vercel.json` as the reference example.
- After any deploy, verify actual production behavior where possible: hit the real subdomain, exercise the specific changed flow (not just "the homepage loads"), and check Vercel function logs for the deploy in question.

## 11. Git

- Use the existing default branch unless explicitly told to use another. Do not invent new long-lived branches without being asked.
- Before committing, inspect `git status` and `git diff` (or run relevant tests/builds) — don't commit blind.
- Never commit `.env`/`.env.local`, real credentials, or the seeded admin password from `apps/DEPLOYMENT.md`.
- Keep commits focused — one logical change per commit; don't bundle an unrelated UI tweak into a bug-fix commit.

## 12. Testing

Match testing effort to the size and risk of the change:

- This repo's real convention is Node's built-in test runner (`node --test`) via `npm run test:*` scripts (e.g. `apps/accounting`'s `test:smartlife`), plus ad hoc `verify:*`/`scripts/verify-*.js` smoke scripts (e.g. `verify-reporting.js`, `verify-financial-workflows.js`, `verify-smarterp-localhost.js`) — there is no formal Jest/Mocha suite. Follow this convention rather than introducing a new test framework unasked.
- For a small, isolated fix: run the specific relevant `node --test` file or `verify:*` script if one exists for that area.
- For an API change: exercise the actual route with real request shapes (valid input, missing/invalid input, unauthenticated, wrong role) — not just "it returns 200 once."
- For anything touching build config, shared code, or multiple apps: run `next build` for every affected app (this is exactly how the CRM `useLanguage` import bug in `ERP_ERRORS.md` was caught — a build succeeded but logged an import-resolution warning that would have been a runtime `TypeError`).
- **Never claim tests passed without actually running them.** If you can't run something (e.g. no live Supabase connection available), say so explicitly rather than asserting success.

## 13. Real Data Policy

**Never fabricate financial, inventory, customer, supplier, quotation, project, or sales data or metrics.** If a number is genuinely unavailable, say so plainly in the UI and in your report — do not infer, estimate, or interpolate a plausible-looking value.

This repo already has the right precedent, established in `apps/DEPLOYMENT.md`: the Cars/Projects dashboard shows **"SAR 0 — not yet tracked"** for the fuel-log metric rather than inventing a number, because there is no real GPS/fuel-log hardware feeding it. Match that standard everywhere:

- Preserve source semantics exactly. `ERP_ERRORS.md`'s `inv_products.qty_on_hand` case is the cautionary example: a denormalized "total across all locations" column must never be presented as if it were a specific warehouse's stock — that's a real, previously-shipped bug (`apps/inventory/lib/stockSync.js` now recomputes and syncs it correctly; don't reintroduce the gap).
- If a feature is genuinely not built (e.g. live GPS tracking, a fuel-log widget, document-upload UI for projects — all explicitly flagged as "not built" in `apps/DEPLOYMENT.md`), say so plainly rather than mocking data to make a screen look complete.

## 14. Accounting/Financial Data

- Use actual source data from `acc_*` tables — never adjust a calculation to make a number "look better" (a rounder margin, a friendlier variance) than what the underlying data supports.
- Preserve accounting meaning precisely: respect the real status vocabularies already fixed in `supabase/inv-schema-v04-accounting-schema-fix.sql` (e.g. invoice status `'Draft'|'Sent'|'Paid'|'Overdue'|'Cancelled'|'Partially Paid'`; payment `payment_type` `'receipt'|'payment'`), and the real column names (`account_code`, `journal_number`, `vendor_name`, `current_balance`, `current_book_value`, etc.) — these were deliberately fixed to match the working API/UI code, not the other way around.
- Explain source limitations in the UI itself where relevant (e.g. Accounting's invoice/bill PDF currently uses the browser's native print dialog, not Quotation's jsPDF/puppeteer/Arabic-shaping pipeline — a documented, intentional scope limit in `ERP_ERRORS.md`, not a bug to silently "fix" by guessing at a redesign).
- Keep PDF/Excel/print/VAT/ZATCA outputs consistent with the same real underlying data — never let one export format diverge from another for the same record.

## 15. Inventory

- Use actual product/stock snapshots from `inv_*` tables — never invent warehouse stock levels, valuation, reorder thresholds, movements, reservations, or transfers.
- `inv_products`/`inv_materials.qty_on_hand` is a **denormalized total** kept in sync by `apps/inventory/lib/stockSync.js` after every mutation (adjustments, receipts, issues, transfers, reservation fulfillment) — if you touch any stock-mutating route, confirm it still calls the sync, or you will reintroduce the "stock never updates" class of bug documented in `ERP_ERRORS.md`.
- Render professional "Not available"/"Not configured" states instead of `undefined`/`null`/`NaN`/broken labels when a value is genuinely missing.
- Never leave a page stuck on "Loading…" forever after an API failure — always resolve to either real data or an explicit error/empty state.
- The Inventory app's real production subdomain is `store.alfarooque.com` per `apps/ERP_STRUCTURE.md` (see §1) — verify before assuming `inventory.alfarooque.com` is correct.

## 16. UI/UX

- Maintain a professional, enterprise appearance: clean hierarchy, restrained glassmorphism (this codebase already uses a `.glass` convention on the root site — match its restraint, don't escalate it), rounded cards, strong spacing, responsive layouts, accessible controls.
- Always implement proper loading, empty, and error states for any data-driven view — never a bare spinner with no fallback.
- No fake KPIs, no broken placeholders, no emoji used as icon substitutes (icons in this codebase use a real icon system, e.g. `<GlassIcon>` in Accounting — follow the existing convention per app rather than substituting emoji).
- Preserve the existing brand identity (design tokens in `css/design-system.css` on the root site; each ERP app has its own but consistent brand assets — `logo.png`/`glass-icons.svg`, per `ERP_ERRORS.md`'s note that Accounting/CRM were missing their `public/` folder and had to be given the same assets already used by the other four apps).
- Don't redesign unrelated areas while fixing a specific bug — scope UI changes to what was asked.

## 17. Responsive/Accessibility

- Verify at desktop, tablet, and ~375px mobile widths for any UI change of consequence.
- Check for overflow/clipping, dropdown/menu positioning near viewport edges, sidebar collapse behavior, keyboard navigability, ARIA labels on icon-only controls, visible focus states, readable table layouts on narrow screens, and adequately sized tap targets on buttons.
- Never introduce an accessibility regression while fixing an unrelated bug.

## 18. Shared Code

- Before modifying any file under `apps/shared/`, or any file documented as "mirrored" across apps (`lib/sso.js`, `lib/appLinks.js`, `components/AppSwitcherButtons.js` — see §9), identify **every consumer** first (grep across `apps/*`).
- Make changes backward-compatible where possible; if not, update every consumer in the same change and note it explicitly.
- Prioritize production-failures, security, and correctness over speculative refactors — do not "clean up" shared code that isn't implicated in the task at hand.

## 19. Token/Time Efficiency

- Don't re-audit files already verified earlier in the same session; don't re-read the whole repo for every new task — inspect only the specific dependency chain implicated by the current change.
- Avoid repetitive explanations, speculative refactors, unnecessary rewrites of already-working systems, or asking questions answerable by inspecting the repo yourself.
- When investigating, prefer targeted reads (a specific file, a scoped grep/glob) over broad unscoped exploration — this repo's `node_modules` trees are large enough that unscoped root-level globs can time out; scope by directory or filename pattern.

## 20. When Something Fails

Classify the failure before deciding what to do:

- **Code defect** — fix it.
- **Configuration defect** (missing/misconfigured env var, wrong Vercel environment) — fix it if you have the access; otherwise report exactly which variable, in which project/environment.
- **Deployment defect** (wrong Root Directory, missing `includeFiles`, stale build) — fix the config, redeploy, verify.
- **Database-source limitation** (data genuinely doesn't exist, e.g. no GPS hardware) — do not fabricate a fix; report it as a real scope gap per §13.
- **Authentication/user-only blocker** (needs the user's own Vercel/Supabase dashboard access, a real credential only they hold, an OAuth consent only they can grant) — isolate it explicitly, continue everything else that doesn't depend on it.
- **External-service failure** (SmartERP/SmartLife unreachable, Supabase outage) — verify it's actually external before blaming it; report with evidence (the actual error, not a guess).
- **Environment/local-machine problem** (a broken local dev tool, a sandbox infra fault unrelated to the repo) — don't let this block reporting on everything else you *could* verify; say plainly what you couldn't check and why.

## 21. Production Evidence

Screenshots, browser console errors, actual API responses, server/function logs, and specific user-reported behavior are **first-class evidence** — weight them above a prior static audit or a "should work" code read. When a user reports a concrete failure, reproduce the exact user-visible behavior and trace root cause through the real system (§4), rather than only re-confirming that an unauthenticated HTTP health check returns 200. A page returning 200 does not mean the authenticated, data-driven flow behind it works — `ERP_ERRORS.md` documents multiple cases where the app "looked complete" but was non-functional against a real database.

## 22. Communication

- Give concise progress updates while working — no need to narrate every file read.
- In a final report, cover: root cause found, what changed, what was tested (and how), deployment status, production verification performed (or why it couldn't be), and any remaining genuine blockers.
- Never say "everything is healthy" if a known runtime failure remains unresolved.
- Never say "nothing else can be done" while non-authenticated engineering work (code fixes, config corrections, additional tests, documentation) remains available — only stop on the specific blocked item.

## 23. Definition of Done

A task is done only when:

- Root cause is understood (not just symptom patched).
- The fix is implemented.
- Relevant tests (per §12) pass — and were actually run.
- The build succeeds for every app touched.
- Deployment succeeds, where deployment was required.
- Production behavior is verified where possible (§21).
- No known regression was introduced (check sibling apps/consumers per §9/§18 if shared code changed).
- Security posture is preserved (§6) — no weakened auth, no exposed secret, no relaxed RLS.
- Any remaining blocker is explicitly isolated as **"BLOCKED — USER ACTION REQUIRED"**, naming only that specific action — and everything else in scope is still completed rather than left waiting on it.

## 24. Final Behavior — Priority Order

When trade-offs are unavoidable, prioritize in this order:

**Correctness → Security → Real Data (§13) → Root-Cause Fixes (not workarounds) → Production Verification → UI Quality → Maintainability → Token Efficiency.**

Never optimize for finishing the conversation quickly. Optimize for leaving the repository and its production applications genuinely working — verified against real behavior, not just against a compiled build or a prior session's claim.
