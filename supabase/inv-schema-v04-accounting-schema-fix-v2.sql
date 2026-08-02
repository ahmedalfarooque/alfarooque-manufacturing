-- =============================================================================
-- AL FAROOQUE ERP — Accounting Schema Correction
-- Version: inv-schema-v04-accounting-schema-fix-v2
-- Run AFTER inv-schema-v02-cross-app.sql (which first defined acc_* tables).
--
-- v2 CHANGE FROM v04: two tables (acc_journal_entries, acc_expenses) declared
-- `created_by uuid references platform_users(id)` inline AND then redeclared
-- the identical constraint again as a named table-level
-- `constraint ..._created_by_fkey foreign key (created_by) references
-- platform_users(id)`. Postgres raises ERROR 42710 ("constraint already
-- exists") on the second, redundant declaration. This file removes the
-- redundant named constraint in both places and keeps only the inline
-- `references` declaration. No table, column, index, data type, or check
-- constraint was changed — this is a duplicate-FK-declaration fix only.
--
-- WHY inv-schema-v04-accounting-schema-fix.sql EXISTS
-- The acc_* table definitions in inv-schema-v02-cross-app.sql were drafted
-- independently from the Next.js API routes in apps/accounting/app/api/**
-- that were actually built against them. Column names, status-enum casing,
-- and even the data model (a claims/lines expense model vs. the flat
-- table the API and UI actually use) drifted apart. Since these tables have
-- never been deployed to Supabase (zero rows), this file safely DROPs and
-- re-CREATEs every table whose shape didn't match the working application
-- code, using the application code as the source of truth. If this has
-- already been run in a database with real data, do NOT run this file —
-- write a data-preserving migration instead.
--
-- Concrete mismatches fixed here:
--   acc_chart_of_accounts : code -> account_code; account_type lowercase -> Capitalized
--   acc_journal_entries   : entry_number -> journal_number; status lowercase -> Capitalized
--   acc_invoices          : status lowercase/incomplete -> Capitalized incl. 'Partially Paid'
--   acc_invoice_lines     : qty/unit_price kept, added sort_order (routes order by it)
--   acc_bills             : supplier_name -> vendor_name; status set -> Draft/Unpaid/Paid/...
--   acc_bill_lines        : added sort_order
--   acc_payments          : payment_type ('received','made') -> ('receipt','payment');
--                           added party_name/invoice_id/bill_id (were only in
--                           a separate acc_payment_allocations table)
--   acc_bank_accounts     : opening_balance -> current_balance
--   acc_bank_transactions : txn_date/txn_type -> transaction_date/transaction_type
--   acc_assets            : useful_life_yrs -> useful_life_years; accumulated_dep ->
--                           accumulated_depreciation; book_value -> current_book_value;
--                           status set -> Active/Disposed/Under Maintenance/Fully Depreciated
--   acc_settings          : did not exist at all — every Settings page save would 404/fail
--   acc_expenses          : did not exist — API/UI use a flat table, schema only had the
--                           unused acc_expense_claims/acc_expense_lines claim model
-- =============================================================================

-- ---------------------------------------------------------------------------
-- acc_chart_of_accounts
-- ---------------------------------------------------------------------------
drop table if exists acc_journal_lines cascade;
drop table if exists acc_journal_entries cascade;
drop table if exists acc_chart_of_accounts cascade;

create table acc_chart_of_accounts (
  id            uuid primary key default gen_random_uuid(),
  account_code  text not null unique,
  name          text not null,
  name_ar       text,
  account_type  text not null check (account_type in ('Asset','Liability','Equity','Revenue','Expense')),
  category      text,
  parent_id     uuid references acc_chart_of_accounts(id),
  description   text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_acc_coa_code   on acc_chart_of_accounts(account_code);
create index idx_acc_coa_type   on acc_chart_of_accounts(account_type);
create index idx_acc_coa_parent on acc_chart_of_accounts(parent_id);

-- ---------------------------------------------------------------------------
-- acc_journal_entries / acc_journal_lines
-- ---------------------------------------------------------------------------
create table acc_journal_entries (
  id             uuid primary key default gen_random_uuid(),
  journal_number text unique,
  entry_date     date not null default current_date,
  description    text,
  reference      text,
  status         text not null default 'Draft' check (status in ('Draft','Posted','Voided')),
  currency       text not null default 'SAR',
  total_debit    numeric(16,4) not null default 0,
  total_credit   numeric(16,4) not null default 0,
  created_by     uuid references platform_users(id),
  posted_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_acc_je_date   on acc_journal_entries(entry_date desc);
create index idx_acc_je_status on acc_journal_entries(status);

create table acc_journal_lines (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references acc_journal_entries(id) on delete cascade,
  account_id  uuid not null references acc_chart_of_accounts(id),
  description text,
  debit       numeric(16,4) not null default 0,
  credit      numeric(16,4) not null default 0,
  created_at  timestamptz not null default now()
);

create index idx_acc_jl_entry   on acc_journal_lines(entry_id);
create index idx_acc_jl_account on acc_journal_lines(account_id);

-- ---------------------------------------------------------------------------
-- acc_invoices / acc_invoice_lines  (Accounts Receivable)
-- ---------------------------------------------------------------------------
drop table if exists acc_invoice_lines cascade;
drop table if exists acc_invoices cascade;

create table acc_invoices (
  id               uuid primary key default gen_random_uuid(),
  invoice_number   text unique,
  customer_name    text not null,
  customer_email   text,
  customer_address text,
  invoice_date     date not null default current_date,
  due_date         date,
  currency         text not null default 'SAR',
  subtotal         numeric(16,4) not null default 0,
  tax_amount       numeric(16,4) not null default 0,
  total_amount     numeric(16,4) not null default 0,
  status           text not null default 'Draft' check (status in ('Draft','Sent','Paid','Overdue','Cancelled','Partially Paid')),
  notes            text,
  project_id       uuid,
  created_by       uuid references platform_users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_acc_inv_status   on acc_invoices(status);
create index idx_acc_inv_date     on acc_invoices(invoice_date desc);
create index idx_acc_inv_due      on acc_invoices(due_date);

create table acc_invoice_lines (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid not null references acc_invoices(id) on delete cascade,
  inv_product_id uuid references inv_products(id),
  description    text not null,
  qty            numeric(14,4) not null default 1,
  unit_price     numeric(14,4) not null default 0,
  tax_rate       numeric(6,4) not null default 15,
  line_total     numeric(16,4) not null default 0,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

create index idx_acc_invl_invoice on acc_invoice_lines(invoice_id);

-- ---------------------------------------------------------------------------
-- acc_bills / acc_bill_lines  (Accounts Payable)
-- ---------------------------------------------------------------------------
drop table if exists acc_bill_lines cascade;
drop table if exists acc_bills cascade;

create table acc_bills (
  id             uuid primary key default gen_random_uuid(),
  bill_number    text unique,
  vendor_name    text not null,
  vendor_email   text,
  vendor_address text,
  bill_date      date not null default current_date,
  due_date       date,
  currency       text not null default 'SAR',
  subtotal       numeric(16,4) not null default 0,
  tax_amount     numeric(16,4) not null default 0,
  total_amount   numeric(16,4) not null default 0,
  status         text not null default 'Draft' check (status in ('Draft','Unpaid','Paid','Overdue','Cancelled','Partially Paid')),
  notes          text,
  project_id     uuid,
  created_by     uuid references platform_users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_acc_bill_status on acc_bills(status);
create index idx_acc_bill_date   on acc_bills(bill_date desc);

create table acc_bill_lines (
  id              uuid primary key default gen_random_uuid(),
  bill_id         uuid not null references acc_bills(id) on delete cascade,
  inv_product_id  uuid references inv_products(id),
  inv_material_id uuid references inv_materials(id),
  description     text not null,
  qty             numeric(14,4) not null default 1,
  unit_price      numeric(14,4) not null default 0,
  tax_rate        numeric(6,4) not null default 15,
  line_total      numeric(16,4) not null default 0,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

create index idx_acc_billl_bill on acc_bill_lines(bill_id);

-- ---------------------------------------------------------------------------
-- acc_bank_accounts / acc_bank_transactions
-- (created before acc_payments, which references acc_bank_accounts)
-- ---------------------------------------------------------------------------
drop table if exists acc_bank_transactions cascade;
drop table if exists acc_bank_accounts cascade;

create table acc_bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  bank_name       text,
  account_number  text,
  iban            text,
  currency        text not null default 'SAR',
  current_balance numeric(16,4) not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- acc_payments
-- (created before acc_bank_transactions, which references acc_payments)
-- ---------------------------------------------------------------------------
drop table if exists acc_payments cascade;

create table acc_payments (
  id              uuid primary key default gen_random_uuid(),
  payment_number  text unique,
  payment_type    text not null check (payment_type in ('receipt','payment')),
  payment_date    date not null default current_date,
  amount          numeric(16,4) not null,
  currency        text not null default 'SAR',
  bank_account_id uuid references acc_bank_accounts(id),
  reference       text,
  party_name      text,
  invoice_id      uuid references acc_invoices(id),
  bill_id         uuid references acc_bills(id),
  notes           text,
  created_by      uuid references platform_users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_acc_pay_date on acc_payments(payment_date desc);
create index idx_acc_pay_type on acc_payments(payment_type);

create table acc_bank_transactions (
  id               uuid primary key default gen_random_uuid(),
  bank_account_id  uuid not null references acc_bank_accounts(id) on delete restrict,
  transaction_date date not null default current_date,
  transaction_type text not null check (transaction_type in ('credit','debit')),
  amount           numeric(16,4) not null,
  description      text,
  reference        text,
  payment_id       uuid references acc_payments(id),
  created_by       uuid references platform_users(id),
  created_at       timestamptz not null default now()
);

create index idx_acc_bt_bank on acc_bank_transactions(bank_account_id);
create index idx_acc_bt_date on acc_bank_transactions(transaction_date desc);

-- ---------------------------------------------------------------------------
-- acc_expenses  (flat model — matches the API/UI; supersedes the unused
-- acc_expense_claims/acc_expense_lines claim model from v02, which no route
-- or page ever implemented a submission workflow for)
-- ---------------------------------------------------------------------------
create table if not exists acc_expenses (
  id              uuid primary key default gen_random_uuid(),
  expense_date    date not null default current_date,
  description     text not null,
  category        text not null default 'General',
  amount          numeric(16,4) not null,
  currency        text not null default 'SAR',
  tax_amount      numeric(16,4) not null default 0,
  vendor_name     text,
  receipt_url     text,
  project_id      uuid,
  bank_account_id uuid references acc_bank_accounts(id),
  status          text not null default 'Pending' check (status in ('Pending','Approved','Rejected','Paid')),
  notes           text,
  created_by      uuid references platform_users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_acc_exp_status on acc_expenses(status);
create index if not exists idx_acc_exp_date   on acc_expenses(expense_date desc);
create index if not exists idx_acc_exp_category on acc_expenses(category);

-- ---------------------------------------------------------------------------
-- acc_assets  (fixed assets)
-- ---------------------------------------------------------------------------
drop table if exists acc_asset_depreciation cascade;
drop table if exists acc_assets cascade;

create table acc_assets (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  category                text not null default 'Equipment',
  description             text,
  purchase_date           date not null default current_date,
  purchase_cost           numeric(16,4) not null default 0,
  salvage_value           numeric(16,4) not null default 0,
  useful_life_years       numeric(5,2) not null default 5,
  depreciation_method     text not null default 'straight_line' check (depreciation_method in ('straight_line','declining_balance')),
  current_book_value      numeric(16,4) not null default 0,
  accumulated_depreciation numeric(16,4) not null default 0,
  status                  text not null default 'Active' check (status in ('Active','Disposed','Under Maintenance','Fully Depreciated')),
  vendor_name             text,
  serial_number           text,
  location                text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_acc_assets_status on acc_assets(status);
create index idx_acc_assets_category on acc_assets(category);

-- ---------------------------------------------------------------------------
-- acc_settings  (did not exist at all in v02 — Settings page would 404)
-- ---------------------------------------------------------------------------
create table if not exists acc_settings (
  id                uuid primary key default gen_random_uuid(),
  company_name      text,
  company_name_ar   text,
  vat_number        text,
  cr_number         text,
  address           text,
  address_ar        text,
  phone             text,
  email             text,
  default_currency  text not null default 'SAR',
  fiscal_year_start text not null default '01-01',
  vat_rate          numeric(6,4) not null default 15,
  invoice_prefix    text not null default 'INV',
  bill_prefix       text not null default 'BILL',
  journal_prefix    text not null default 'JE',
  updated_at        timestamptz not null default now()
);

-- =============================================================================
-- Row Level Security intentionally disabled — service-role key used
-- server-side only via lib/db.js, same pattern as inv_* and crm_* tables.
-- =============================================================================
