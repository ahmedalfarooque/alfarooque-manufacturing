-- =============================================================================
-- AL FAROOQUE ERP — Phase 2 Cross-App Inventory Links
-- Version: inv-schema-v02-cross-app
-- Run AFTER inv-schema-v01-initial.sql
-- Adds nullable FK links from existing apps to inv_* tables — all backward-compat
-- =============================================================================

-- ---------------------------------------------------------------------------
-- QuotePro: link cost lines to inventory materials
-- ---------------------------------------------------------------------------
alter table qt_qp_cost_lines
  add column if not exists inv_material_id uuid references inv_materials(id) on delete set null;

create index if not exists idx_qt_cost_lines_inv_material on qt_qp_cost_lines(inv_material_id);

-- ---------------------------------------------------------------------------
-- Projects: link purchase requests to inventory products / materials
-- ---------------------------------------------------------------------------
alter table pm_purchase_requests
  add column if not exists inv_material_id uuid references inv_materials(id) on delete set null,
  add column if not exists inv_product_id  uuid references inv_products(id)  on delete set null;

create index if not exists idx_pm_pr_inv_material on pm_purchase_requests(inv_material_id);
create index if not exists idx_pm_pr_inv_product  on pm_purchase_requests(inv_product_id);

-- ---------------------------------------------------------------------------
-- Cars: structured parts list for maintenance records
-- ---------------------------------------------------------------------------
create table if not exists car_maintenance_parts (
  id             uuid primary key default gen_random_uuid(),
  record_id      uuid not null references car_maintenance_records(id) on delete cascade,
  inv_product_id uuid references inv_products(id) on delete set null,
  name           text not null,
  qty            numeric(10,4) not null default 1,
  unit_cost      numeric(14,4),
  created_at     timestamptz not null default now()
);

create index if not exists idx_car_parts_record  on car_maintenance_parts(record_id);
create index if not exists idx_car_parts_product on car_maintenance_parts(inv_product_id);

-- =============================================================================
-- Accounting tables (acc_ prefix)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- acc_periods  (fiscal periods / months)
-- ---------------------------------------------------------------------------
create table if not exists acc_periods (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  is_closed   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- acc_chart_of_accounts
-- ---------------------------------------------------------------------------
create table if not exists acc_chart_of_accounts (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  name_ar       text,
  account_type  text not null check (account_type in ('asset','liability','equity','revenue','expense')),
  account_class text,
  parent_id     uuid references acc_chart_of_accounts(id),
  is_header     boolean not null default false,
  is_active     boolean not null default true,
  currency      text not null default 'SAR',
  notes         text,
  created_by    uuid references platform_users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_acc_coa_code   on acc_chart_of_accounts(code);
create index if not exists idx_acc_coa_type   on acc_chart_of_accounts(account_type);
create index if not exists idx_acc_coa_parent on acc_chart_of_accounts(parent_id);

-- ---------------------------------------------------------------------------
-- acc_cost_centers  (projects, departments, warehouses)
-- ---------------------------------------------------------------------------
create table if not exists acc_cost_centers (
  id         uuid primary key default gen_random_uuid(),
  code       text unique,
  name       text not null,
  cc_type    text check (cc_type in ('department','project','warehouse','other')) default 'department',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- acc_tax_codes  (VAT codes — Saudi ZATCA)
-- ---------------------------------------------------------------------------
create table if not exists acc_tax_codes (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  name_ar    text,
  rate_pct   numeric(6,4) not null default 15,
  tax_type   text check (tax_type in ('vat','exempt','zero_rated','out_of_scope')) default 'vat',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- Default VAT codes
insert into acc_tax_codes (code, name, name_ar, rate_pct, tax_type) values
  ('VAT15', 'Standard VAT 15%', 'ضريبة القيمة المضافة 15%', 15, 'vat'),
  ('ZERO',  'Zero Rated',       'معفى صفري', 0, 'zero_rated'),
  ('EXEMPT','Exempt',            'معفى',      0, 'exempt')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- acc_journal_entries  (GL — immutable after posting)
-- ---------------------------------------------------------------------------
create table if not exists acc_journal_entries (
  id             uuid primary key default gen_random_uuid(),
  entry_number   text unique,
  entry_date     date not null default current_date,
  period_id      uuid references acc_periods(id),
  description    text,
  reference      text,
  entry_type     text not null default 'manual' check (entry_type in (
                   'manual','invoice','payment','bill','expense','depreciation',
                   'inventory','adjustment','opening','closing')),
  status         text not null default 'draft' check (status in ('draft','posted','reversed')),
  currency       text not null default 'SAR',
  total_debit    numeric(16,4) not null default 0,
  total_credit   numeric(16,4) not null default 0,
  source_type    text,
  source_id      uuid,
  created_by     uuid references platform_users(id),
  posted_by      uuid references platform_users(id),
  posted_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_acc_je_date    on acc_journal_entries(entry_date desc);
create index if not exists idx_acc_je_status  on acc_journal_entries(status);
create index if not exists idx_acc_je_type    on acc_journal_entries(entry_type);
create index if not exists idx_acc_je_source  on acc_journal_entries(source_type, source_id);

-- ---------------------------------------------------------------------------
-- acc_journal_lines  (GL lines — double-entry)
-- ---------------------------------------------------------------------------
create table if not exists acc_journal_lines (
  id             uuid primary key default gen_random_uuid(),
  entry_id       uuid not null references acc_journal_entries(id) on delete cascade,
  account_id     uuid not null references acc_chart_of_accounts(id),
  cost_center_id uuid references acc_cost_centers(id),
  description    text,
  debit          numeric(16,4) not null default 0,
  credit         numeric(16,4) not null default 0,
  currency       text not null default 'SAR',
  sort           int not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_acc_jl_entry   on acc_journal_lines(entry_id);
create index if not exists idx_acc_jl_account on acc_journal_lines(account_id);

-- ---------------------------------------------------------------------------
-- acc_bank_accounts
-- ---------------------------------------------------------------------------
create table if not exists acc_bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  account_number  text,
  iban            text,
  bank_name       text,
  branch          text,
  currency        text not null default 'SAR',
  gl_account_id   uuid references acc_chart_of_accounts(id),
  opening_balance numeric(16,4) not null default 0,
  is_active       boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- acc_bank_transactions
-- ---------------------------------------------------------------------------
create table if not exists acc_bank_transactions (
  id              uuid primary key default gen_random_uuid(),
  bank_account_id uuid not null references acc_bank_accounts(id) on delete restrict,
  txn_date        date not null default current_date,
  txn_type        text not null check (txn_type in ('credit','debit')),
  amount          numeric(16,4) not null,
  currency        text not null default 'SAR',
  description     text,
  reference       text,
  is_reconciled   boolean not null default false,
  reconciled_at   timestamptz,
  journal_entry_id uuid references acc_journal_entries(id),
  created_by      uuid references platform_users(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_acc_bt_bank   on acc_bank_transactions(bank_account_id);
create index if not exists idx_acc_bt_date   on acc_bank_transactions(txn_date desc);
create index if not exists idx_acc_bt_recon  on acc_bank_transactions(is_reconciled);

-- ---------------------------------------------------------------------------
-- acc_suppliers (mirrors inv_suppliers — cross-reference)
-- Note: prefer using inv_suppliers directly; this is for accounting-specific fields
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- acc_invoices  (Accounts Receivable — sales invoices)
-- ---------------------------------------------------------------------------
create table if not exists acc_invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_number  text unique,
  invoice_date    date not null default current_date,
  due_date        date,
  customer_id     uuid references platform_users(id),
  customer_name   text not null,
  customer_vat    text,
  customer_cr     text,
  customer_address text,
  status          text not null default 'draft' check (status in ('draft','sent','partial','paid','overdue','cancelled','void')),
  currency        text not null default 'SAR',
  subtotal        numeric(16,4) not null default 0,
  discount_amount numeric(16,4) not null default 0,
  tax_amount      numeric(16,4) not null default 0,
  total_amount    numeric(16,4) not null default 0,
  paid_amount     numeric(16,4) not null default 0,
  balance_due     numeric(16,4) not null default 0,
  source_type     text,
  source_id       uuid,
  payment_terms   text,
  notes           text,
  zatca_uuid      text,
  zatca_hash      text,
  journal_entry_id uuid references acc_journal_entries(id),
  created_by      uuid references platform_users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_acc_inv_status   on acc_invoices(status);
create index if not exists idx_acc_inv_date     on acc_invoices(invoice_date desc);
create index if not exists idx_acc_inv_customer on acc_invoices(customer_id);
create index if not exists idx_acc_inv_due      on acc_invoices(due_date);

-- ---------------------------------------------------------------------------
-- acc_invoice_lines
-- ---------------------------------------------------------------------------
create table if not exists acc_invoice_lines (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid not null references acc_invoices(id) on delete cascade,
  inv_product_id uuid references inv_products(id),
  description    text not null,
  qty            numeric(14,4) not null default 1,
  unit_price     numeric(14,4) not null default 0,
  discount_pct   numeric(6,4) not null default 0,
  tax_code_id    uuid references acc_tax_codes(id),
  tax_rate       numeric(6,4) not null default 15,
  line_total     numeric(16,4) not null default 0,
  sort           int not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_acc_invl_invoice on acc_invoice_lines(invoice_id);

-- ---------------------------------------------------------------------------
-- acc_bills  (Accounts Payable — vendor bills)
-- ---------------------------------------------------------------------------
create table if not exists acc_bills (
  id              uuid primary key default gen_random_uuid(),
  bill_number     text unique,
  bill_date       date not null default current_date,
  due_date        date,
  supplier_id     uuid references inv_suppliers(id),
  supplier_name   text not null,
  status          text not null default 'draft' check (status in ('draft','received','partial','paid','overdue','cancelled')),
  currency        text not null default 'SAR',
  subtotal        numeric(16,4) not null default 0,
  tax_amount      numeric(16,4) not null default 0,
  total_amount    numeric(16,4) not null default 0,
  paid_amount     numeric(16,4) not null default 0,
  balance_due     numeric(16,4) not null default 0,
  po_id           uuid references inv_purchase_orders(id),
  payment_terms   text,
  notes           text,
  journal_entry_id uuid references acc_journal_entries(id),
  created_by      uuid references platform_users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_acc_bill_status   on acc_bills(status);
create index if not exists idx_acc_bill_date     on acc_bills(bill_date desc);
create index if not exists idx_acc_bill_supplier on acc_bills(supplier_id);

-- ---------------------------------------------------------------------------
-- acc_bill_lines
-- ---------------------------------------------------------------------------
create table if not exists acc_bill_lines (
  id             uuid primary key default gen_random_uuid(),
  bill_id        uuid not null references acc_bills(id) on delete cascade,
  inv_product_id uuid references inv_products(id),
  inv_material_id uuid references inv_materials(id),
  description    text not null,
  qty            numeric(14,4) not null default 1,
  unit_cost      numeric(14,4) not null default 0,
  tax_code_id    uuid references acc_tax_codes(id),
  tax_rate       numeric(6,4) not null default 15,
  line_total     numeric(16,4) not null default 0,
  sort           int not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_acc_billl_bill on acc_bill_lines(bill_id);

-- ---------------------------------------------------------------------------
-- acc_payments  (payments received/made)
-- ---------------------------------------------------------------------------
create table if not exists acc_payments (
  id              uuid primary key default gen_random_uuid(),
  payment_number  text unique,
  payment_date    date not null default current_date,
  payment_type    text not null check (payment_type in ('received','made')),
  payment_method  text not null default 'bank' check (payment_method in ('bank','cash','cheque','online')),
  amount          numeric(16,4) not null,
  currency        text not null default 'SAR',
  bank_account_id uuid references acc_bank_accounts(id),
  reference       text,
  notes           text,
  status          text not null default 'pending' check (status in ('pending','confirmed','bounced','cancelled')),
  journal_entry_id uuid references acc_journal_entries(id),
  created_by      uuid references platform_users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_acc_pay_date   on acc_payments(payment_date desc);
create index if not exists idx_acc_pay_type   on acc_payments(payment_type);
create index if not exists idx_acc_pay_status on acc_payments(status);

-- ---------------------------------------------------------------------------
-- acc_payment_allocations  (link payments to invoices/bills)
-- ---------------------------------------------------------------------------
create table if not exists acc_payment_allocations (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid not null references acc_payments(id) on delete cascade,
  invoice_id  uuid references acc_invoices(id),
  bill_id     uuid references acc_bills(id),
  amount      numeric(16,4) not null,
  created_at  timestamptz not null default now(),
  constraint acc_pa_one_target check (
    (invoice_id is not null and bill_id is null) or
    (invoice_id is null and bill_id is not null)
  )
);

-- ---------------------------------------------------------------------------
-- acc_expense_claims
-- ---------------------------------------------------------------------------
create table if not exists acc_expense_claims (
  id          uuid primary key default gen_random_uuid(),
  claim_number text unique,
  claim_date  date not null default current_date,
  submitted_by uuid references platform_users(id),
  status      text not null default 'draft' check (status in ('draft','submitted','approved','rejected','paid')),
  total_amount numeric(16,4) not null default 0,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists acc_expense_lines (
  id              uuid primary key default gen_random_uuid(),
  claim_id        uuid not null references acc_expense_claims(id) on delete cascade,
  expense_date    date not null,
  category        text not null,
  description     text not null,
  amount          numeric(16,4) not null,
  currency        text not null default 'SAR',
  tax_code_id     uuid references acc_tax_codes(id),
  cost_center_id  uuid references acc_cost_centers(id),
  receipt_url     text,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- acc_assets  (fixed assets)
-- ---------------------------------------------------------------------------
create table if not exists acc_assets (
  id               uuid primary key default gen_random_uuid(),
  asset_number     text unique,
  name             text not null,
  description      text,
  category         text,
  acquisition_date date not null default current_date,
  cost             numeric(16,4) not null default 0,
  salvage_value    numeric(16,4) not null default 0,
  useful_life_yrs  numeric(5,2) not null default 5,
  depreciation_method text not null default 'straight_line' check (depreciation_method in ('straight_line','declining_balance')),
  accumulated_dep  numeric(16,4) not null default 0,
  book_value       numeric(16,4) not null default 0,
  status           text not null default 'active' check (status in ('active','disposed','fully_depreciated')),
  location         text,
  serial_number    text,
  gl_account_id    uuid references acc_chart_of_accounts(id),
  notes            text,
  created_by       uuid references platform_users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_acc_assets_status on acc_assets(status);

create table if not exists acc_asset_depreciation (
  id          uuid primary key default gen_random_uuid(),
  asset_id    uuid not null references acc_assets(id) on delete cascade,
  period_id   uuid references acc_periods(id),
  dep_date    date not null,
  amount      numeric(16,4) not null,
  book_value  numeric(16,4) not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- acc_user_roles
-- ---------------------------------------------------------------------------
create table if not exists acc_user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references platform_users(id) on delete cascade,
  role       text not null check (role in ('admin','accountant','viewer','ap','ar')),
  granted_by uuid references platform_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- CRM tables (crm_ prefix)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- crm_pipeline_stages
-- ---------------------------------------------------------------------------
create table if not exists crm_pipeline_stages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  name_ar    text,
  sort       int not null default 0,
  probability numeric(5,2) not null default 0,
  color      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into crm_pipeline_stages (name, name_ar, sort, probability, color) values
  ('New Lead',       'عميل جديد',     1, 10,  '#06b6d4'),
  ('Qualified',      'مؤهل',           2, 25,  '#0ea5e9'),
  ('Proposal Sent',  'تم إرسال العرض', 3, 50,  '#6366f1'),
  ('Negotiation',    'تفاوض',          4, 75,  '#f59e0b'),
  ('Won',            'مكسوب',          5, 100, '#10b981'),
  ('Lost',           'خسارة',          6, 0,   '#ef4444')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- crm_contacts  (people — leads, customers, prospects)
-- ---------------------------------------------------------------------------
create table if not exists crm_contacts (
  id           uuid primary key default gen_random_uuid(),
  first_name   text not null,
  last_name    text,
  email        text,
  phone        text,
  mobile       text,
  company      text,
  job_title    text,
  source       text,
  country      text default 'Saudi Arabia',
  city         text,
  address      text,
  notes        text,
  is_customer  boolean not null default false,
  is_active    boolean not null default true,
  assigned_to  uuid references platform_users(id),
  created_by   uuid references platform_users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_crm_contacts_email    on crm_contacts(email);
create index if not exists idx_crm_contacts_company  on crm_contacts(company);
create index if not exists idx_crm_contacts_assigned on crm_contacts(assigned_to);

-- ---------------------------------------------------------------------------
-- crm_deals  (pipeline opportunities)
-- ---------------------------------------------------------------------------
create table if not exists crm_deals (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  contact_id   uuid references crm_contacts(id),
  stage_id     uuid references crm_pipeline_stages(id),
  value        numeric(16,4) not null default 0,
  currency     text not null default 'SAR',
  close_date   date,
  probability  numeric(5,2),
  status       text not null default 'open' check (status in ('open','won','lost','stalled')),
  source       text,
  qt_quotation_id uuid,
  notes        text,
  assigned_to  uuid references platform_users(id),
  created_by   uuid references platform_users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_crm_deals_stage    on crm_deals(stage_id);
create index if not exists idx_crm_deals_status   on crm_deals(status);
create index if not exists idx_crm_deals_assigned on crm_deals(assigned_to);
create index if not exists idx_crm_deals_close    on crm_deals(close_date);

-- ---------------------------------------------------------------------------
-- crm_activities  (calls, meetings, tasks, emails, notes)
-- ---------------------------------------------------------------------------
create table if not exists crm_activities (
  id              uuid primary key default gen_random_uuid(),
  activity_type   text not null check (activity_type in ('call','meeting','task','email','note','follow_up')),
  subject         text not null,
  description     text,
  contact_id      uuid references crm_contacts(id),
  deal_id         uuid references crm_deals(id),
  due_date        timestamptz,
  duration_min    int,
  status          text not null default 'pending' check (status in ('pending','completed','cancelled','no_show')),
  outcome         text,
  assigned_to     uuid references platform_users(id),
  created_by      uuid references platform_users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_crm_act_type     on crm_activities(activity_type);
create index if not exists idx_crm_act_status   on crm_activities(status);
create index if not exists idx_crm_act_contact  on crm_activities(contact_id);
create index if not exists idx_crm_act_deal     on crm_activities(deal_id);
create index if not exists idx_crm_act_due      on crm_activities(due_date);
create index if not exists idx_crm_act_assigned on crm_activities(assigned_to);

-- ---------------------------------------------------------------------------
-- crm_user_roles
-- ---------------------------------------------------------------------------
create table if not exists crm_user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references platform_users(id) on delete cascade,
  role       text not null check (role in ('admin','manager','sales','readonly')),
  granted_by uuid references platform_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- Chart of Accounts: default Saudi Arabia seed data
-- =============================================================================

-- Level 1 headers
insert into acc_chart_of_accounts (code, name, name_ar, account_type, is_header) values
  ('1000', 'Assets',             'الأصول',              'asset',     true),
  ('2000', 'Liabilities',        'الخصوم',              'liability', true),
  ('3000', 'Equity',             'حقوق الملكية',         'equity',    true),
  ('4000', 'Revenue',            'الإيرادات',            'revenue',   true),
  ('5000', 'Cost of Goods Sold', 'تكلفة البضاعة المباعة','expense',   true),
  ('6000', 'Expenses',           'المصروفات',            'expense',   true)
on conflict do nothing;

-- Level 2
insert into acc_chart_of_accounts (code, name, name_ar, account_type, is_header) values
  ('1100', 'Current Assets',         'الأصول المتداولة',         'asset',     true),
  ('1200', 'Fixed Assets',           'الأصول الثابتة',           'asset',     true),
  ('2100', 'Current Liabilities',    'الخصوم المتداولة',          'liability', true),
  ('2200', 'Long-Term Liabilities',  'الخصوم طويلة الأجل',       'liability', true),
  ('4100', 'Sales Revenue',          'إيرادات المبيعات',         'revenue',   true),
  ('5100', 'Direct Costs',           'التكاليف المباشرة',         'expense',   true),
  ('6100', 'Operating Expenses',     'مصروفات التشغيل',          'expense',   true),
  ('6200', 'Administrative Expenses','مصروفات إدارية',           'expense',   true)
on conflict do nothing;

-- Level 3 — operational accounts
insert into acc_chart_of_accounts (code, name, name_ar, account_type) values
  ('1101', 'Cash on Hand',           'النقد في الصندوق',      'asset'),
  ('1102', 'Bank — SAR',             'البنك — ريال سعودي',   'asset'),
  ('1103', 'Accounts Receivable',    'الذمم المدينة',         'asset'),
  ('1104', 'Inventory',              'المخزون',               'asset'),
  ('1105', 'Prepaid Expenses',       'مصروفات مدفوعة مقدماً','asset'),
  ('1201', 'Machinery & Equipment',  'الآلات والمعدات',       'asset'),
  ('1202', 'Vehicles',               'المركبات',              'asset'),
  ('1203', 'Accumulated Depreciation','مجمع الإهلاك',         'asset'),
  ('2101', 'Accounts Payable',       'الذمم الدائنة',         'liability'),
  ('2102', 'VAT Payable',            'ضريبة القيمة المضافة',  'liability'),
  ('2103', 'Accrued Expenses',       'مصروفات مستحقة',       'liability'),
  ('2104', 'Customer Deposits',      'عربون العملاء',         'liability'),
  ('3001', 'Share Capital',          'رأس المال',             'equity'),
  ('3002', 'Retained Earnings',      'الأرباح المحتجزة',      'equity'),
  ('4101', 'Product Sales',          'مبيعات المنتجات',       'revenue'),
  ('4102', 'Service Revenue',        'إيرادات الخدمات',       'revenue'),
  ('5101', 'Raw Material Cost',      'تكلفة المواد الخام',    'expense'),
  ('5102', 'Direct Labour',          'عمالة مباشرة',          'expense'),
  ('6101', 'Rent',                   'الإيجار',               'expense'),
  ('6102', 'Utilities',              'المرافق',               'expense'),
  ('6103', 'Telephone & Internet',   'هاتف وإنترنت',          'expense'),
  ('6104', 'Vehicle Expenses',       'مصروفات المركبات',      'expense'),
  ('6105', 'Maintenance',            'صيانة',                 'expense'),
  ('6201', 'Salaries & Wages',       'رواتب وأجور',           'expense'),
  ('6202', 'Staff Benefits',         'مزايا الموظفين',        'expense'),
  ('6203', 'Travel & Entertainment', 'سفر وترفيه',            'expense'),
  ('6204', 'Depreciation',           'إهلاك',                 'expense')
on conflict do nothing;
