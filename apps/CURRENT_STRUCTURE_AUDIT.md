# AL FAROOQUE ERP — Current Structure Audit

Audit date: 2026-08-10. Inspection only — **no code was changed**.

Sources inspected: local working tree, `git`/GitHub `origin/main`, Vercel (live
project + domain state), Supabase (live table/row state).

---

## 1. Application map (as actually found)

| Application | Path | Localhost | Production domain | Vercel project | Prefix |
|---|---|---|---|---|---|
| QuotePro (Quotation & Costing) | `apps/quotation` | 3030 | `quotation.alfarooque.com` | `af-quotation` | `qt_` |
| Projects | `apps/projects` | 3020 | `projects.alfarooque.com` | `af-project-management` | `pm_` |
| Cars | `apps/cars` | 3010 | `cars.alfarooque.com` | `af-cars-tracking` | `car_` |
| Inventory | `apps/inventory` | 3040 | `inventory.alfarooque.com` | `af-inventory` | `inv_` |
| Accounting | `apps/accounting` | 3050 | `accounting.alfarooque.com` | `af-accounting` | `acc_` |
| CRM | `apps/crm` | 3060 | `crm.alfarooque.com` | `af-crm` | `crm_` |
| Public website | repo root | 3000 | `alfarooque.com` | `alfarooque-manufacturing` | `products`, `orders`, … |
| Business card | `card/` | 3005 | `mohammed.alfarooque.com` | (served by main site) | — |

All six ERP apps: framework `nextjs`, Node `24.x`, latest production deployment
`READY`, each its own Vercel project. No duplicate projects. No `packages/`
directory exists — matches the instruction not to introduce one.

Shared/common code lives in `apps/shared/` (not a workspace package — plain
`require()` across app boundaries).

- Repository: `ahmedalfarooque/alfarooque-manufacturing`
- Branch: `main` (local `HEAD` == `origin/main` == `d4445ba`, 0 ahead / 0 behind)
- Database: one Supabase project, shared by every app, isolated by table prefix
- Auth: `platform_users` / `platform_otp_codes` / `platform_sessions` shared
  across all six apps, plus `af_sso_session` admin SSO cookie on
  `.alfarooque.com`

---

## 2. Connection map (as actually wired)

```
                     SmartLife / SmartERP  (external financial source)
                                 │  read-only
                                 ▼
                  apps/shared/integrationPlatform.js
                    THE single SmartLife connector
                                 │
                                 ▼
                 CRM  /api/integrations/smartlife/data/[resource]
                        (central integration host)
                                 │
                                 ▼
              Accounting  lib/smartlife.js  (thin HTTP proxy — no
              second connector, calls CRM's central endpoint)

  QuotePro ──send-to-projects──▶ Projects ──▶ project creation
  QuotePro / Projects / Cars / Inventory / Accounting / CRM
        └── one Supabase project, prefixed tables, shared IDs ──┘
        └── af_sso_session admin SSO + app switcher ────────────┘

  Public website (alfarooque.com) ──▶ orders / quotes / customers
        (separate from SmartLife, as required)
```

**Central integration verified correct.** There is exactly one SmartLife
connector. Accounting does not re-implement it — `apps/accounting/lib/smartlife.js`
is a 38-line HTTP client pointing at CRM's central route. This matches the
"no separate SmartLife connectors in every application" requirement.

**SmartLife is read-only today**, with the write gate already implemented in
`apps/shared/integrationPlatform.js`:
`SmartErpWriteAuthorizationError` (HTTP 403), a red `SMARTERP WRITE PERMISSION
REQUIRED` notice carrying target/record/action, an explicit authorization phrase
(`AUTHORIZE SMARTERP CHANGE`), and an audit write. UI counterpart:
`apps/crm/components/SmartErpWritePermissionWarning.js`. Future write-back is
possible but gated — not permanently prohibited.

Live evidence SmartLife sync has actually run: `crm_integrations` 5 rows,
`crm_sync_records` 1752 rows, `crm_integration_audit_logs` 14 rows.

---

## 3. Verified-intact items

- **Modal stacking fix present in all six apps**: `.gmodal-backdrop` `z-index: 50`,
  `.gmodal-panel` `z-index: 51`. No regression.
- **Quotation workflow** (`apps/quotation/lib/quotationWorkflow.js`) uses
  `waiting_quotation_approval` — correctly named "quotation approval", not
  "production approval", per spec. Transitions:
  `draft → waiting_quotation_approval`, `quotation_approved → customer_approved`
  / `customer_rejected`, `customer_approved → project_created`.
- **Delete permission enforced server-side**, not just hidden in UI.
  Shared helper `apps/shared/authorization.js` `getDeleteAuthorization()` —
  admin always allowed; non-admin requires an `app_permissions.can_delete` grant
  *and* an active+approved user. 44 of 52 `DELETE` route handlers call it. The
  other 8 are legitimate and stricter or self-scoped: logout (`/api/auth`),
  admin-only user routes (`requireSession({ adminOnly: true })`), and
  own-user-scoped notification deletes.

---

## 4. Findings requiring a decision

### 4.1 — CRITICAL: localhost, GitHub and Vercel are NOT consistent

133 uncommitted files in the working tree. Local `main` equals `origin/main`,
which means **all of this work exists only on this machine** — it is not on
GitHub and not deployed to any Vercel project.

Entirely untracked (never committed):

```
apps/shared/integrationPlatform.js         ← the central SmartLife connector
apps/shared/integrationPlatform.test.js
apps/shared/authorization.js               ← the delete-permission enforcement
apps/shared/authorization.test.js
apps/shared/DeletePermissionGate.js
apps/shared/quotationProjectWorkflow.js
apps/quotation/lib/quotationWorkflow.js    ← the quotation state machine
apps/quotation/lib/quotationWorkflow.test.js
apps/crm/app/api/integrations/             ← central integration API
apps/crm/app/(protected)/integrations/
apps/crm/components/SmartErpWritePermissionWarning.js
apps/crm/app/api/contacts/[id]/identity/
apps/accounting/app/api/smartlife/
apps/accounting/app/(protected)/smartlife/
apps/accounting/lib/smartlife.js
supabase/migrations/
+ verification scripts under apps/{crm,projects,quotation}/scripts/
```

Modified but uncommitted, by app: projects 28, quotation 23, accounting 16,
crm 16, inventory 16, cars 10.

**Consequence:** production today has *no* SmartLife integration, *no* shared
delete-authorization helper, and *not* the current quotation state machine.
The architecture described in §2 is the **local** architecture. Section 32's
precondition ("LOCALHOST + GITHUB MAIN + VERCEL consistent and verified") is
currently **not met**.

Also present: `apps/projects/.next-delete-final/` — an untracked build-artifact
directory that looks like leftover scratch. Flagging rather than deleting.

### 4.2 — Inventory subdomain mismatch

`lib/appLinks.js` maps inventory to `sub: 'store'` → the app switcher builds
`https://store.alfarooque.com`. The actual bound Vercel domain is
**`inventory.alfarooque.com`**. `store.alfarooque.com` is not bound to the
`af-inventory` project.

The wrong value is identical in all six copies of `appLinks.js`, so the switcher
sends admins to a dead host from every app. `apps/ERP_STRUCTURE.md` documents
`store` too, so the doc and code agree with each other but disagree with reality.

Fix is one word in six mirrored files — but it changes a production URL, so I
have not applied it.

### 4.3 — `app_permissions` table is empty (0 rows)

Delete permission logic is correct, but no non-admin has ever been granted
`can_delete`. Effectively only `role='admin'` can delete anywhere. This may be
intended; noting it so it is a decision rather than a surprise.

### 4.4 — Accounting/CRM modules exist as schema but hold no data

All `acc_*` tables (chart of accounts, journal entries, invoices, bills,
payments, assets, bank transactions) and `crm_contacts` / `crm_deals` /
`crm_activities` are created with RLS on but have **0 rows**. `inv_*` is
likewise empty apart from 8 categories and 14 units. This is consistent with
"no mock data" — the modules are real and wired, simply not yet populated from
SmartLife.

---

## 5. What I did not do

No restructuring, no renames, no deletions, no migrations, no commits, no
deploys — per the instruction to complete the audit first.

The three decisions I need before any change:

1. **Commit + push the 133 uncommitted files to `main`?** This is what makes
   localhost/GitHub/Vercel consistent, and it auto-deploys six production ERP
   apps handling live business data. It is the single highest-impact action in
   this audit and I will not do it unprompted.
2. **Inventory subdomain** — change code to `inventory`, or bind
   `store.alfarooque.com` in Vercel?
3. **`apps/projects/.next-delete-final/`** — leftover scratch to remove, or
   in-progress work to keep?
