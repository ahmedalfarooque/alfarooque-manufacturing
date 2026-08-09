# ERP Database Structure

All tables live in a single Supabase project. No RLS — all access via Next.js API routes using the service-role key.

> **Apply schema files in this exact order** (none have been run yet): `inv-schema-v01-initial.sql` → `inv-schema-v02-cross-app.sql` → `inv-schema-v03-issue-transfer-reservation.sql` → `inv-schema-v04-accounting-schema-fix.sql` → `inv-schema-v05-purchasing-destination.sql` → `inv-schema-v06-crm-cross-links.sql` → `inv-schema-v07-app-permissions.sql`. v04 is **critical** — it corrects a pervasive mismatch between v02's `acc_*` tables and the actual API code (see `ERP_ERRORS.md`).

## Shared / Auth Tables (pre-existing)

```sql
platform_users          -- id (uuid), email, full_name, role, is_active, created_at
otp_codes               -- id, email, code, expires_at, used
platform_login_attempts -- id, email, ip, user_agent, success, created_at
```

## Shared Cross-App Permissions (v07 — new this session)

```sql
app_permissions
  id uuid PK, user_id → platform_users, app_id text CHECK IN
    ('quotation','projects','cars','inventory','accounting','crm'),
  granted_by → platform_users, created_at
  UNIQUE(user_id, app_id)
```
Gates which apps a non-admin user's Application Switcher shows. Admins and the super-admin (`arshad@alfarooque.com`) always see every app regardless of this table.

## Inventory Tables (`inv_*`)

```sql
inv_categories, inv_subcategories, inv_units, inv_brands
inv_suppliers

inv_products
  id, sku, barcode, name, name_ar, description, category_id, subcategory_id,
  unit_id, brand_id, cost_price, selling_price, min_stock_qty, max_stock_qty,
  reorder_point, weight_kg, image_url, notes, is_active,
  qty_on_hand  -- denormalized total across warehouses; kept in sync by lib/stockSync.js
  created_by, created_at, updated_at

inv_materials
  id, material_code, name, name_ar, description, category_id, unit_id,
  supplier_id, cost_price, min_stock_qty, max_stock_qty, reorder_point,
  notes, is_active, qty_on_hand (denormalized, same sync)
  created_by, created_at, updated_at

inv_warehouses, inv_locations

inv_stock  -- per-warehouse ledger
  id, product_id, material_id, warehouse_id, location_id,
  qty_on_hand, qty_reserved, avg_cost, last_cost, updated_at
  UNIQUE(product_id, warehouse_id), UNIQUE(material_id, warehouse_id)

inv_stock_movements  -- immutable audit trail
  id, product_id, material_id, warehouse_id, location_id,
  movement_type CHECK IN ('receipt','issue','transfer_in','transfer_out',
                           'adjustment_in','adjustment_out','return_in','return_out'),
  qty, unit_cost, reference,
  reference_type, reference_id  -- added in v03 (was missing, caused a runtime bug)
  notes, created_by, created_at

inv_purchase_requests, inv_purchase_request_items
inv_purchase_orders, inv_purchase_order_items
inv_goods_receipts, inv_goods_receipt_items

-- New in v03 (this session):
inv_goods_issues
  id, gi_number, warehouse_id, issue_date, issued_to,
  reference_type CHECK IN ('project','department','sales_order','other'),
  reference_id, notes, issued_by, created_at
inv_goods_issue_items
  id, gi_id, product_id, material_id, qty_issued, unit_cost

inv_stock_transfers
  id, transfer_number, from_warehouse_id, to_warehouse_id, transfer_date,
  notes, created_by, created_at
inv_stock_transfer_items
  id, transfer_id, product_id, material_id, qty

inv_stock_reservations
  id, product_id, material_id, warehouse_id, qty,
  status CHECK IN ('active','released','fulfilled'),
  reference_type CHECK IN ('sales_order','project','other'),
  reference_id, reference_label, notes, reserved_by, created_at, released_at

inv_user_roles  -- role CHECK IN ('admin','manager','warehouse','purchasing','readonly')
```

## Accounting Tables (`acc_*`) — corrected in v04, extended in v05

```sql
acc_chart_of_accounts
  id, account_code (unique), name, name_ar,
  account_type CHECK IN ('Asset','Liability','Equity','Revenue','Expense'),
  category, parent_id, description, is_active, created_at, updated_at

acc_journal_entries
  id, journal_number (unique), entry_date, description, reference,
  status CHECK IN ('Draft','Posted','Voided'),
  currency, total_debit, total_credit, created_by, posted_at, created_at, updated_at

acc_journal_lines
  id, entry_id, account_id, description, debit, credit, created_at

acc_invoices
  id, invoice_number (unique), customer_name, customer_email, customer_address,
  invoice_date, due_date, currency, subtotal, tax_amount, total_amount,
  status CHECK IN ('Draft','Sent','Paid','Overdue','Cancelled','Partially Paid'),
  notes, project_id, created_by, created_at, updated_at

acc_invoice_lines
  id, invoice_id, inv_product_id, description, qty, unit_price,
  tax_rate, line_total, sort_order, created_at

acc_bills
  id, bill_number (unique), vendor_name, vendor_email, vendor_address,
  bill_date, due_date, currency, subtotal, tax_amount, total_amount,
  status CHECK IN ('Draft','Unpaid','Paid','Overdue','Cancelled','Partially Paid'),
  notes, project_id, created_by, created_at, updated_at,
  -- Purchasing destination (v05):
  destination_type CHECK IN ('warehouse','project','asset'),
  destination_warehouse_id → inv_warehouses, asset_category

acc_bill_lines
  id, bill_id, inv_product_id, inv_material_id, description, qty,
  unit_price, tax_rate, line_total, sort_order, created_at

acc_bank_accounts
  id, name, bank_name, account_number, iban, currency,
  current_balance, is_active, created_at, updated_at

acc_payments
  id, payment_number (unique),
  payment_type CHECK IN ('receipt','payment'),
  payment_date, amount, currency, bank_account_id, reference,
  party_name, invoice_id, bill_id, notes, created_by, created_at, updated_at

acc_bank_transactions
  id, bank_account_id, transaction_date,
  transaction_type CHECK IN ('credit','debit'),
  amount, description, reference, payment_id, created_by, created_at

acc_expenses  -- flat model (v04); supersedes the unused acc_expense_claims/acc_expense_lines
  id, expense_date, description, category, amount, currency, tax_amount,
  vendor_name, receipt_url, project_id, bank_account_id,
  status CHECK IN ('Pending','Approved','Rejected','Paid'),
  notes, created_by, created_at, updated_at

acc_assets
  id, name, category, description, purchase_date, purchase_cost, salvage_value,
  useful_life_years, depreciation_method CHECK IN ('straight_line','declining_balance'),
  current_book_value, accumulated_depreciation,
  status CHECK IN ('Active','Disposed','Under Maintenance','Fully Depreciated'),
  vendor_name, serial_number, location, created_at, updated_at

acc_settings  -- did not exist before v04
  id, company_name, company_name_ar, vat_number, cr_number,
  address, address_ar, phone, email, default_currency, fiscal_year_start,
  vat_rate, invoice_prefix, bill_prefix, journal_prefix, updated_at

acc_user_roles  -- role CHECK IN ('admin','accountant','ap','ar','viewer')
```

### Auxiliary tables from v02 kept but not actively used by any route (future-proofing, harmless)
`acc_periods`, `acc_cost_centers`, `acc_tax_codes`, `acc_payment_allocations`, `acc_expense_claims`, `acc_expense_lines`, `acc_asset_depreciation` — left in place for potential future use (fiscal period close, cost-center reporting, a proper claims-based expense workflow) but nothing currently reads or writes them.

## CRM Tables (`crm_*`) — extended in v06

```sql
crm_contacts
  id, name, email, phone, company, job_title, contact_type CHECK IN
    ('Lead','Prospect','Customer','Partner','Supplier'),
  source, address, notes, assigned_to, created_by, created_at

crm_deals
  id, title, contact_id, value, currency, stage CHECK IN
    ('Prospecting','Qualification','Proposal','Negotiation','Closed Won','Closed Lost'),
  status CHECK IN ('Open','Won','Lost','On Hold'),
  probability, expected_close_date, description, assigned_to, created_by, created_at,
  -- Cross-app links (v06):
  linked_quotation_id → qt_quotations, linked_project_id → pm_projects

crm_activities
  id, activity_type CHECK IN ('Call','Meeting','Email','Demo','Follow-up','Task','Note'),
  subject, contact_id, deal_id, activity_date, duration_minutes,
  status CHECK IN ('Planned','Completed','Cancelled','No Show'),
  outcome, notes, assigned_to, created_by, created_at

crm_settings
  id, company_name, default_currency, deal_stages, activity_types,
  contact_sources, win_probability_threshold, updated_at

crm_user_roles  -- role CHECK IN ('admin','manager','sales','viewer')
```

## Table Counts by Phase

| Phase | Tables |
|-------|--------|
| Shared Auth + Permissions | 4 |
| Phase 1 Inventory (incl. v03 additions) | 10 |
| Phase 2 Accounting (active) | 12 |
| Phase 2 Accounting (auxiliary, unused) | 7 |
| Phase 3 CRM | 4 |
| **Total** | **37** |

## Cross-App Read/Write Pattern

No table is ever duplicated across apps. Instead, apps read (and in Accounting's Purchasing case, write) directly into another app's tables via the shared Supabase service-role client — the same pattern already established for `inv_*` reads from Quotation/Projects/Cars:

- Quotation, Projects, Cars, Accounting → read `inv_products`/`inv_materials`/`inv_warehouses` (search/pickers)
- Accounting (Purchasing "Warehouse" destination) → writes `inv_stock`/`inv_stock_movements` directly
- Accounting reports → read `inv_stock` (valuation) and `pm_projects` (costing)
- CRM → reads `qt_quotations`/`pm_projects` (deal links)
