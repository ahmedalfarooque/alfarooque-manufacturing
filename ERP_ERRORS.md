# ERP Build Errors and Fixes

## Accounting App

### Error 1 — Non-existent Component Names
**File**: `apps/accounting/app/(protected)/dashboard/page.js`
**Error**: Imported `StatCard`, `PageHeader`, `Badge` which do not exist in `glass.js`
**Fix**: Rewrote dashboard to use only verified exports from `glass.js`: `GlassCard`, `GlassBadge`, inline JSX stat tiles
**Root cause**: Assumed component names without checking actual exports

### Error 2 — Missing `useLang` Export
**Potential**: `Shell.js` referenced `useLang` from `i18n.js`, but accounting's i18n exports `useLanguage`
**Status**: Verified exports before writing Shell; used correct hook name throughout

## CRM App

### No build errors — compiled successfully on first attempt.
Both `npx next build` runs returned `✓ Compiled successfully` with zero type errors (JS-only codebase, no TypeScript strictness).

## Cross-App Integration

### No errors in inventory-search routes.
The three new routes (quotation, projects, cars) follow the identical pattern of the inventory app's own search route.

## Known Limitations (Not Errors)

1. **Journal Entry creation page** (`/journal-entries/new`) is linked from the list page but not yet built — this requires a multi-line debit/credit form with running balance validation. Listed as remaining work.

2. **Accounting app and CRM app are not deployed to Vercel** — Vercel is only configured for the static website, quotation, projects, and cars. The ERP apps run on self-hosted ports (3060, 3080) and need separate Vercel project setup or a server deployment.

3. **Database tables not yet created** — All `acc_*` and `crm_*` table DDL is in `supabase/inv-schema-v02-cross-app.sql` and must be run in Supabase before the apps will function.
