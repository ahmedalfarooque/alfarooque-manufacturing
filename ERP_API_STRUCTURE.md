# ERP API Structure

All routes are Next.js 14 App Router Route Handlers under `app/api/`. All return JSON. Authentication via JWT cookie parsed server-side. Service-role key never leaves the server.

## Authentication Pattern

Every protected route calls `requireSession(request)` which:
1. Reads `af_<app>_session` cookie (app-specific JWT)
2. Falls back to `af_sso_session` cookie (SSO JWT from any other app)
3. Verifies JWT with `JWT_SECRET`
4. Returns `{ sub, email, role, appRole }`

Admin-only routes additionally call `requireAdmin(session)` which checks `session.appRole === 'admin'` or `session.email === 'arshad@alfarooque.com'` (super-admin bypass).

## Inventory App (`localhost:3040/api/`)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/auth` | POST | `action: login\|verify-otp\|logout` |
| `/api/dashboard` | GET | Stats + recent activity |
| `/api/items` | GET, POST | List (search, category, low-stock filter) + create |
| `/api/items/[id]` | GET, PATCH, DELETE | Item detail + edit + delete |
| `/api/categories` | GET, POST | Category list + create |
| `/api/categories/[id]` | PATCH, DELETE | Edit + delete |
| `/api/warehouses` | GET, POST | Warehouse list + create |
| `/api/warehouses/[id]` | PATCH, DELETE | Edit + delete |
| `/api/stock` | GET | Stock levels with join (item + warehouse) |
| `/api/stock/[id]` | PATCH | Adjust quantity |
| `/api/transactions` | GET, POST | Transaction history + new transaction |
| `/api/suppliers` | GET, POST | Supplier list + create |
| `/api/suppliers/[id]` | PATCH, DELETE | Edit + delete |
| `/api/reports` | GET | `type=valuation\|movement\|low_stock` |
| `/api/settings` | GET, PATCH | App settings |
| `/api/inventory-search` | GET | Cross-app search (used by quotation/projects/cars) |

## Accounting App (`localhost:3060/api/`)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/auth` | POST | `action: login\|verify-otp\|logout` |
| `/api/dashboard` | GET | Key metrics + recent invoices/bills/expenses |
| `/api/chart-of-accounts` | GET, POST | Account list (search, type filter) + create |
| `/api/chart-of-accounts/[id]` | PATCH, DELETE | Edit + delete |
| `/api/journal-entries` | GET, POST | Paginated list (search, status) + create |
| `/api/journal-entries/[id]` | GET, PATCH, DELETE | Detail + post/void + delete |
| `/api/invoices` | GET, POST | Paginated list (search, status) + create |
| `/api/invoices/[id]` | GET, PATCH, DELETE | Detail + status change + delete |
| `/api/bills` | GET, POST | Paginated list (search, status) + create |
| `/api/bills/[id]` | GET, PATCH, DELETE | Detail + status change + delete |
| `/api/payments` | GET, POST | List (type filter) + create |
| `/api/payments/[id]` | PATCH, DELETE | Edit + delete |
| `/api/banking` | GET, POST | Bank account list + create |
| `/api/banking/transactions` | GET, POST | Transactions (account filter) + add |
| `/api/expenses` | GET, POST | List (category filter) + submit |
| `/api/expenses/[id]` | PATCH, DELETE | Approve/reject/pay + delete (adminOnly) |
| `/api/assets` | GET, POST | Asset list (category, status filter) + create |
| `/api/assets/[id]` | PATCH, DELETE | Edit + dispose + delete |
| `/api/reports` | GET | `type=income_statement\|balance_sheet\|cash_flow\|vat\|summary` |
| `/api/settings` | GET, PATCH | Company + financial settings (upsert) |

### Report Query Parameters

| Report Type | Extra Params | Notes |
|-------------|-------------|-------|
| `income_statement` | `from`, `to` | Revenue from invoices, COGS from bills, OpEx from expenses |
| `balance_sheet` | — (current snapshot) | Assets vs Liabilities + Equity |
| `cash_flow` | `from`, `to` | Inflows/outflows from bank transactions |
| `vat` | `from`, `to` | Output VAT (sales) vs Input VAT (purchases) |
| `summary` | — | Counts and totals across all modules |

## CRM App (`localhost:3080/api/`)

| Route | Methods | Description |
|-------|---------|-------------|
| `/api/auth` | POST | `action: login\|verify-otp\|logout` |
| `/api/dashboard` | GET | Key metrics + recent contacts/deals |
| `/api/contacts` | GET, POST | List (search, type filter) + create |
| `/api/contacts/[id]` | GET, PATCH, DELETE | Profile + linked deals + activities |
| `/api/deals` | GET, POST | Paginated list (search, status, stage) + create |
| `/api/deals/[id]` | GET, PATCH, DELETE | Detail + Mark Won/Lost + delete |
| `/api/activities` | GET, POST | List (type, status filter, pagination) + log |
| `/api/activities/[id]` | PATCH, DELETE | Complete/update + delete |
| `/api/pipeline` | GET | Deals grouped by stage with counts and values |
| `/api/reports` | GET | `type=summary\|deals\|activities` |
| `/api/settings` | GET, PATCH | CRM settings (upsert) |

### CRM Pipeline Response Shape

```json
{
  "pipeline": [
    {
      "stage": "Prospecting",
      "count": 5,
      "total_value": 250000,
      "deals": [
        {
          "id": "uuid",
          "title": "Deal Title",
          "value": 50000,
          "probability": 20,
          "expected_close_date": "2026-09-30",
          "crm_contacts": { "name": "Ahmed", "company": "ACME" }
        }
      ]
    }
  ],
  "total_open": 12,
  "total_value": 850000
}
```

## Cross-App Inventory Search (shared endpoint)

Each app exposes `/api/inventory-search?q=<query>` which:
1. Validates session (any authenticated user)
2. Queries `inv_items` with join to `inv_stock` + `inv_warehouses`
3. Returns up to 20 matches: `{ id, sku, name, unit, stock }`

Available in:
- `apps/quotation/app/api/inventory-search/route.js`
- `apps/projects/app/api/inventory-search/route.js`
- `apps/cars/app/api/inventory-search/route.js`

## Error Response Format

All API errors follow:
```json
{ "error": "Human-readable message" }
```
With appropriate HTTP status codes:
- `400` Bad Request (validation failure)
- `401` Unauthorized (no valid session)
- `403` Forbidden (insufficient role)
- `404` Not Found
- `500` Internal Server Error

## Auth Flow (OTP)

```
POST /api/auth { action: 'login', email, password }
  → validates against platform_users (bcrypt)
  → checks app_user_roles for app access
  → generates 6-digit OTP, stores in otp_codes (5 min TTL)
  → returns { step: 'otp' }

POST /api/auth { action: 'verify-otp', email, otp }
  → validates OTP (not expired, not used)
  → marks OTP as used
  → mints JWT (24h) with { sub, email, role, appRole }
  → sets af_<app>_session cookie (HttpOnly, SameSite=Lax)
  → sets af_sso_session cookie (HttpOnly, SameSite=Lax, same payload)
  → returns { ok: true }

POST /api/auth { action: 'logout' }
  → clears both cookies
  → returns { ok: true }
```
