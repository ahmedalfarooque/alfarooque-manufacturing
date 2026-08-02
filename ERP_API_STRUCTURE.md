# ERP API Structure

All routes are Next.js 14 App Router Route Handlers under `app/api/`. All return JSON. Authentication via JWT cookie parsed server-side. Service-role key never leaves the server.

## Authentication Pattern

Every protected route calls `requireSession(request, { adminOnly? })` which:
1. Reads the app-specific `af_<app>_session` cookie
2. Falls back to `af_sso_session` (SSO JWT, works across all 6 apps since this session's fixes)
3. Applies the super-admin override (`arshad@alfarooque.com` → always `role: 'admin'`) — now consistent across **all 6 apps** including Cars, which was missing it before this session
4. Returns `{ sub, email, role }` or a 401/403 response

## Shared Cross-App Route (new this session, mirrored across all 6 apps)

```
GET  /api/app-permissions              — own granted app list ({apps: [...]})
GET  /api/app-permissions?user_id=<id> — (admin only) another user's granted apps
POST /api/app-permissions {user_id, apps: [...]} — (admin only) replace a user's grant list
```
Admins/super-admin get the full 6-app list regardless of table contents.

## Inventory App (`localhost:3040/api/`)

| Route | Methods | Notes |
|-------|---------|-------|
| `/api/auth` | POST | `action: login\|verify-otp\|logout` |
| `/api/dashboard` | GET | Stats + recent activity |
| `/api/items`, `/api/products`, `/api/materials` | GET, POST / PATCH / DELETE | Full CRUD |
| `/api/categories`, `/api/subcategories`, `/api/units`, `/api/brands` | GET, POST | Reference data |
| `/api/warehouses`, `/api/locations` | GET, POST / PATCH / DELETE | |
| `/api/stock` | GET, POST | POST = manual adjustment; now calls `stockSync` after |
| `/api/stock-movements` | GET | Read-only ledger |
| `/api/goods-receipts` | GET, POST | Receives stock in; syncs denormalized qty |
| `/api/goods-issues` | GET, POST | **New.** Issues stock out to project/department/sales order/other |
| `/api/transfers` | GET, POST | **New.** Warehouse-to-warehouse move, paired movements |
| `/api/reservations` | GET, POST | **New.** Soft-holds available stock (`qty_reserved`) |
| `/api/reservations/[id]` | PATCH | **New.** `action: release\|fulfill` |
| `/api/purchase-requests`, `/api/purchase-orders` | GET, POST / PATCH / DELETE | Full CRUD |
| `/api/suppliers` | GET, POST / PATCH / DELETE | |
| `/api/search` | GET | In-app search (products/materials/suppliers) |
| `/api/reports` (via `/stats`) | GET | Stock valuation, movements, low stock, purchasing |
| `/api/settings`, `/api/users`, `/api/roles` | GET / PATCH | |

## Accounting App (`localhost:3050/api/`)

| Route | Methods | Notes |
|-------|---------|-------|
| `/api/auth` | POST | `action: login\|verify-otp\|logout` |
| `/api/dashboard` | GET | Fixed to query `acc_expenses` (was querying the unused `acc_expense_claims`) |
| `/api/chart-of-accounts` | GET, POST | `account_code`, Capitalized `account_type` |
| `/api/chart-of-accounts/[id]` | GET, PATCH, DELETE | |
| `/api/journal-entries` | GET, POST | Requires ≥2 balanced lines |
| `/api/journal-entries/[id]` | GET, PATCH, DELETE | `action: post\|void` |
| `/api/invoices` | GET, POST | **Now accepts `lines: [...]`**, auto-computes subtotal/tax/total when provided |
| `/api/invoices/[id]` | GET, PATCH, DELETE | Returns `{ invoice, lines }` |
| `/api/bills` | GET, POST | **Now accepts `lines: [...]` and Purchasing destination fields** |
| `/api/bills/[id]` | GET, PATCH, DELETE | Returns `{ bill, lines }` |
| `/api/payments` | GET, POST | `payment_type: 'receipt'\|'payment'` |
| `/api/payments/[id]` | GET, PATCH, DELETE | |
| `/api/banking` | GET, POST | Bank accounts |
| `/api/banking/transactions` | GET, POST | `transaction_type/transaction_date` |
| `/api/expenses` | GET, POST | Flat model — any authenticated user may submit |
| `/api/expenses/[id]` | GET, PATCH (admin), DELETE (admin) | |
| `/api/assets` | GET, POST | Fixed asset register |
| `/api/assets/[id]` | GET, PATCH, DELETE | |
| `/api/reports` | GET | `type=income_statement\|balance_sheet\|cash_flow\|vat\|inventory_valuation\|project_costing\|summary` |
| `/api/settings` | GET, PATCH | Now backed by a real `acc_settings` table (didn't exist before this session) |
| `/api/inventory-search` | GET | **New.** Reads `inv_products`/`inv_materials` directly, powers the Purchasing warehouse-destination line-item picker |
| `/api/warehouses` | GET | **New.** Reads `inv_warehouses` directly |

### Report Query Parameters

| Report Type | Extra Params | Notes |
|-------------|-------------|-------|
| `income_statement` | `from`, `to` | Revenue (invoices) − COGS (bills) − OpEx (expenses) |
| `balance_sheet` | — | Cash, receivables, fixed assets vs payables, equity |
| `cash_flow` | `from`, `to` | From `acc_bank_transactions` |
| `vat` | `from`, `to` | Output VAT (sales) vs input VAT (purchases) |
| `inventory_valuation` | — | **New.** Reads `inv_stock` directly; total value + by-warehouse + top 200 lines |
| `project_costing` | `from`, `to` | **New.** Reads `pm_projects` directly; revenue (invoices) vs cost (bills+expenses) per project, computes margin |
| `summary` | — | Counts and totals across all modules |

### Purchasing Destination Logic (in `POST /api/bills`)

When `destination_type` is set:
- `'warehouse'` (requires `destination_warehouse_id`) — for each bill line with an `inv_product_id`/`inv_material_id`, directly increments `inv_stock` and writes `inv_stock_movements` (movement type `receipt`, `reference_type: 'acc_bill'`), then re-syncs the denormalized `inv_products`/`inv_materials.qty_on_hand`.
- `'project'` — no inventory change; `project_id` tags the bill (already worked; now an explicit named destination).
- `'asset'` — auto-inserts a new `acc_assets` row (`purchase_cost = total_amount`, `category = asset_category`).

## CRM App (`localhost:3060/api/`)

| Route | Methods | Notes |
|-------|---------|-------|
| `/api/auth` | POST | `action: login\|verify-otp\|logout` |
| `/api/dashboard` | GET | Key metrics + recent contacts/deals |
| `/api/contacts` | GET, POST | |
| `/api/contacts/[id]` | GET, PATCH, DELETE | Profile + linked deals + activities |
| `/api/deals` | GET, POST | **Now accepts `linked_quotation_id`/`linked_project_id`** |
| `/api/deals/[id]` | GET, PATCH, DELETE | GET now also returns `linkedQuotation`/`linkedProject` (name/status looked up directly from `qt_quotations`/`pm_projects`) |
| `/api/activities` | GET, POST | |
| `/api/activities/[id]` | PATCH, DELETE | |
| `/api/pipeline` | GET | Deals grouped by stage |
| `/api/reports` | GET | `type=summary\|deals\|activities` |
| `/api/settings` | GET, PATCH | |

## Cross-App Inventory Search (shared endpoint, mirrored in Quotation/Projects/Cars/Accounting)

`GET /api/inventory-search?q=<query>` — validates session, queries `inv_products`/`inv_materials` directly, returns up to 10 matches each. Now actually consumed by:
- **Projects**: Purchase Request modal's "Link to Inventory Item" picker
- **Cars**: Maintenance Record modal's inventory parts picker
- **Accounting**: Bill line items when Purchasing destination is `'warehouse'`
- **Quotation**: route exists but intentionally not wired into the UI (see `ERP_REMAINING.md` — Quotation's catalogue is a deliberately separate pricing system, not a stock duplicate)

## Error Response Format

All API errors follow:
```json
{ "error": "Human-readable message" }
```
HTTP status codes: `400` validation, `401` no session, `403` insufficient role, `404` not found, `500` server error.

## Auth Flow (OTP) — unchanged, now consistent across all 6 apps

```
POST /api/auth { action: 'login', email, password }
  → validates against platform_users (bcrypt)
  → generates 6-digit OTP, stores in otp_codes (5 min TTL)
  → returns { step: 'otp' }

POST /api/auth { action: 'verify-otp', email, otp }
  → validates OTP, marks used
  → mints JWT (12h) with { sub, email, role, app }
  → sets af_<app>_session cookie + af_sso_session cookie
  → returns { ok: true }

POST /api/auth { action: 'logout' }
  → clears both cookies (now clears all 6 apps' cookies via the corrected
    APP_COOKIE_NAMES list in every app's lib/sso.js)
  → returns { ok: true }
```
