-- SmartLife remains read-only. These tables store source snapshots and AL FAROOQUE ERP workflow relationships only.
create table if not exists public.erp_financial_source_records (
  id uuid primary key default gen_random_uuid(), tenant_id text not null default 'alfarooque',
  source_system text not null default 'smartlife' check (source_system = 'smartlife'),
  record_type text not null check (record_type in ('sales_invoice','purchase_invoice','payment','expense','account','financial_report')),
  external_id text not null, source_reference text, party_name text, record_date date, due_date date,
  currency text not null default 'SAR', subtotal numeric(18,2) not null default 0,
  vat_amount numeric(18,2) not null default 0, total_amount numeric(18,2) not null default 0,
  paid_amount numeric(18,2) not null default 0, balance_amount numeric(18,2) not null default 0,
  source_status text, raw_payload jsonb not null default '{}'::jsonb, source_updated_at timestamptz,
  last_synced_at timestamptz not null default now(), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique (tenant_id, source_system, record_type, external_id)
);

create table if not exists public.erp_financial_connections (
  id uuid primary key default gen_random_uuid(), tenant_id text not null default 'alfarooque',
  source_record_id uuid not null references public.erp_financial_source_records(id) on delete cascade,
  project_id uuid references public.pm_projects(id) on delete cascade,
  purchase_request_id uuid references public.pm_purchase_requests(id) on delete set null,
  purchase_order_id uuid references public.inv_purchase_orders(id) on delete set null,
  goods_receipt_id uuid references public.inv_goods_receipts(id) on delete set null,
  workflow_status text not null default 'connected', internal_notes text,
  created_by uuid references public.platform_users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, source_record_id),
  check (project_id is not null or purchase_request_id is not null or purchase_order_id is not null or goods_receipt_id is not null)
);

create table if not exists public.erp_project_payments (
  id uuid primary key default gen_random_uuid(), tenant_id text not null default 'alfarooque',
  project_id uuid not null references public.pm_projects(id) on delete cascade,
  source_record_id uuid not null references public.erp_financial_source_records(id) on delete cascade,
  origin text not null default 'local_erp' check (origin in ('local_erp','smartlife')),
  external_id text, direction text not null check (direction in ('received','made')),
  amount numeric(18,2) not null check (amount > 0), payment_date date not null,
  payment_method text, reference text, notes text,
  created_by uuid references public.platform_users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create unique index if not exists erp_project_payments_source_external_uidx on public.erp_project_payments (tenant_id, origin, external_id) where external_id is not null;
create index if not exists erp_financial_source_type_date_idx on public.erp_financial_source_records (tenant_id, record_type, record_date desc);
create index if not exists erp_financial_connections_project_idx on public.erp_financial_connections (project_id, source_record_id) where project_id is not null;
create index if not exists erp_financial_connections_source_idx on public.erp_financial_connections (source_record_id);
create index if not exists erp_financial_connections_purchase_request_idx on public.erp_financial_connections (purchase_request_id) where purchase_request_id is not null;
create index if not exists erp_financial_connections_purchase_order_idx on public.erp_financial_connections (purchase_order_id) where purchase_order_id is not null;
create index if not exists erp_financial_connections_goods_receipt_idx on public.erp_financial_connections (goods_receipt_id) where goods_receipt_id is not null;
create index if not exists erp_financial_connections_created_by_idx on public.erp_financial_connections (created_by) where created_by is not null;
create index if not exists erp_project_payments_project_date_idx on public.erp_project_payments (project_id, payment_date desc);
create index if not exists erp_project_payments_source_idx on public.erp_project_payments (source_record_id, payment_date desc);
create index if not exists erp_project_payments_created_by_idx on public.erp_project_payments (created_by) where created_by is not null;

alter table public.erp_financial_source_records enable row level security;
alter table public.erp_financial_connections enable row level security;
alter table public.erp_project_payments enable row level security;
revoke all on table public.erp_financial_source_records, public.erp_financial_connections, public.erp_project_payments from anon, authenticated;
grant select, insert, update, delete on table public.erp_financial_source_records, public.erp_financial_connections, public.erp_project_payments to service_role;
drop policy if exists "Server-only financial source access" on public.erp_financial_source_records;
create policy "Server-only financial source access" on public.erp_financial_source_records for all to service_role using (true) with check (true);
drop policy if exists "Server-only financial connection access" on public.erp_financial_connections;
create policy "Server-only financial connection access" on public.erp_financial_connections for all to service_role using (true) with check (true);
drop policy if exists "Server-only project payment access" on public.erp_project_payments;
create policy "Server-only project payment access" on public.erp_project_payments for all to service_role using (true) with check (true);
