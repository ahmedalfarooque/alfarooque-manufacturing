# ERP Database Structure

All tables live in a single Supabase project. No RLS — all access via Next.js API routes using the service-role key.

## Shared / Auth Tables (pre-existing)

```sql
platform_users          -- id (uuid), email, full_name, role, is_active, created_at
otp_codes               -- id, email, code, expires_at, used
platform_login_attempts -- id, email, ip, user_agent, success, created_at
```

## Inventory Tables (`inv_*`)

```sql
inv_categories
  id uuid PK, name text, description text, created_at

inv_items
  id uuid PK, sku text UNIQUE, name text, name_ar text,
  category_id → inv_categories, unit text, barcode text,
  description text, min_stock int, is_active bool, created_at

inv_warehouses
  id uuid PK, name text, location text, is_active bool

inv_stock
  id uuid PK, item_id → inv_items, warehouse_id → inv_warehouses,
  quantity numeric, updated_at
  UNIQUE(item_id, warehouse_id)

inv_transactions
  id uuid PK, item_id → inv_items, warehouse_id → inv_warehouses,
  transaction_type text CHECK IN ('in','out','adjustment','transfer'),
  quantity numeric, unit_cost numeric, reference text,
  notes text, created_by → platform_users, created_at

inv_suppliers
  id uuid PK, name text, contact_person text, email text,
  phone text, address text, is_active bool, created_at

inv_user_roles
  id uuid PK, user_id → platform_users UNIQUE,
  role text CHECK IN ('admin','manager','staff','viewer')
```

## Accounting Tables (`acc_*`)

```sql
acc_chart_of_accounts
  id uuid PK, account_code text UNIQUE, account_type text
    CHECK IN ('Asset','Liability','Equity','Revenue','Expense'),
  name text, name_ar text, category text, is_active bool,
  parent_id → acc_chart_of_accounts (self-ref), created_at

acc_journal_entries
  id uuid PK, entry_number text UNIQUE, entry_date date,
  description text, status text CHECK IN ('Draft','Posted','Void'),
  created_by → platform_users, posted_at, created_at

acc_journal_lines
  id uuid PK, entry_id → acc_journal_entries,
  account_id → acc_chart_of_accounts,
  debit numeric DEFAULT 0, credit numeric DEFAULT 0,
  description text, sort_order int

acc_invoices
  id uuid PK, invoice_number text UNIQUE,
  customer_name text, customer_email text, customer_address text,
  invoice_date date, due_date date, currency text DEFAULT 'SAR',
  subtotal numeric, tax_amount numeric, total_amount numeric,
  status text CHECK IN ('Draft','Sent','Paid','Overdue','Cancelled','Partially Paid'),
  notes text, project_id uuid, created_by → platform_users, created_at

acc_invoice_lines
  id uuid PK, invoice_id → acc_invoices,
  description text, quantity numeric, unit_price numeric,
  tax_rate numeric DEFAULT 15, line_total numeric

acc_bills
  id uuid PK, bill_number text UNIQUE,
  vendor_name text, vendor_email text, vendor_address text,
  bill_date date, due_date date, currency text DEFAULT 'SAR',
  subtotal numeric, tax_amount numeric, total_amount numeric,
  status text CHECK IN ('Draft','Unpaid','Paid','Overdue','Cancelled','Partially Paid'),
  notes text, project_id uuid, created_by → platform_users, created_at

acc_bill_lines
  id uuid PK, bill_id → acc_bills,
  description text, quantity numeric, unit_price numeric,
  tax_rate numeric DEFAULT 15, line_total numeric

acc_bank_accounts
  id uuid PK, name text, bank_name text,
  account_number text, iban text, currency text DEFAULT 'SAR',
  current_balance numeric DEFAULT 0, is_active bool DEFAULT true, created_at

acc_bank_transactions
  id uuid PK, bank_account_id → acc_bank_accounts,
  transaction_type text CHECK IN ('credit','debit'),
  amount numeric, transaction_date date,
  description text, reference text, created_at

acc_payments
  id uuid PK, payment_number text UNIQUE,
  payment_type text CHECK IN ('receipt','payment'),
  payment_date date, amount numeric, currency text DEFAULT 'SAR',
  bank_account_id → acc_bank_accounts,
  reference text, party_name text,
  invoice_id → acc_invoices (nullable),
  bill_id → acc_bills (nullable),
  notes text, created_by → platform_users, created_at

acc_expenses
  id uuid PK, expense_date date, category text, amount numeric,
  currency text DEFAULT 'SAR', description text, receipt_url text,
  status text CHECK IN ('Pending','Approved','Rejected','Paid'),
  submitted_by → platform_users, approved_by → platform_users (nullable),
  project_id uuid, created_at

acc_assets
  id uuid PK, asset_name text, category text,
  purchase_date date, purchase_cost numeric, currency text DEFAULT 'SAR',
  useful_life_years int, depreciation_method text
    CHECK IN ('straight_line','declining_balance'),
  current_book_value numeric, accumulated_depreciation numeric DEFAULT 0,
  status text CHECK IN ('Active','Disposed','Under Maintenance','Fully Depreciated'),
  disposal_date date, disposal_value numeric,
  notes text, created_at

acc_settings
  id uuid PK DEFAULT gen_random_uuid(),
  company_name text, company_name_ar text,
  vat_number text, cr_number text,
  address text, address_ar text, phone text, email text,
  default_currency text DEFAULT 'SAR',
  fiscal_year_start text DEFAULT '01-01',
  vat_rate numeric DEFAULT 15,
  invoice_prefix text DEFAULT 'INV', bill_prefix text DEFAULT 'BILL',
  journal_prefix text DEFAULT 'JE', updated_at

acc_user_roles
  id uuid PK, user_id → platform_users UNIQUE,
  role text CHECK IN ('admin','accountant','viewer')
```

## CRM Tables (`crm_*`)

```sql
crm_contacts
  id uuid PK, name text NOT NULL, email text, phone text,
  company text, position text, address text,
  contact_type text CHECK IN ('Lead','Prospect','Customer','Partner','Supplier'),
  source text, notes text,
  assigned_to → platform_users, created_by → platform_users, created_at

crm_deals
  id uuid PK, title text NOT NULL,
  contact_id → crm_contacts (nullable),
  value numeric DEFAULT 0, currency text DEFAULT 'SAR',
  stage text CHECK IN ('Prospecting','Qualification','Proposal','Negotiation',
                        'Closed Won','Closed Lost'),
  status text CHECK IN ('Open','Won','Lost','On Hold'),
  probability int DEFAULT 0,
  expected_close_date date, description text,
  assigned_to → platform_users, created_by → platform_users, created_at

crm_activities
  id uuid PK,
  activity_type text CHECK IN ('Call','Meeting','Email','Demo','Follow-up','Task','Note'),
  subject text NOT NULL,
  contact_id → crm_contacts (nullable),
  deal_id → crm_deals (nullable),
  activity_date date, duration_minutes int,
  status text CHECK IN ('Planned','Completed','Cancelled','No Show'),
  outcome text, notes text,
  assigned_to → platform_users, created_by → platform_users, created_at

crm_settings
  id uuid PK DEFAULT gen_random_uuid(),
  company_name text, default_currency text DEFAULT 'SAR',
  deal_stages jsonb, activity_types jsonb,
  contact_sources jsonb, win_probability_threshold int DEFAULT 70,
  updated_at

crm_user_roles
  id uuid PK, user_id → platform_users UNIQUE,
  role text CHECK IN ('admin','manager','sales','viewer')
```

## Table Counts by Phase

| Phase | Tables |
|-------|--------|
| Shared Auth | 3 |
| Phase 1 Inventory | 7 |
| Phase 2 Accounting | 12 |
| Phase 3 CRM | 5 |
| **Total** | **27** |

## SQL Schema File

`supabase/inv-schema-v02-cross-app.sql` — run in Supabase SQL editor to create all `acc_*` and `crm_*` tables. The `inv_*` tables are in a prior schema file.
