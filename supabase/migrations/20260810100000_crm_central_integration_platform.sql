-- CRM central integration platform (additive, source-of-truth preserving).
create table if not exists public.crm_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'alfarooque',
  integration_key text not null,
  name text not null,
  provider text not null,
  integration_type text not null default 'erp',
  enabled boolean not null default false,
  status text not null default 'disabled' check (status in ('connected','syncing','warning','error','disabled','not_configured')),
  sync_direction text not null default 'pull' check (sync_direction in ('pull','push','bidirectional','none')),
  sync_frequency_minutes integer,
  config jsonb not null default '{}'::jsonb,
  secret_ciphertext text,
  secret_iv text,
  secret_tag text,
  last_sync_at timestamptz,
  next_sync_at timestamptz,
  last_error text,
  configured_by uuid references public.platform_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, integration_key)
);

create table if not exists public.crm_customer_identities (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'alfarooque',
  crm_contact_id uuid references public.crm_contacts(id) on delete cascade,
  display_name text not null,
  normalized_email text,
  normalized_phone text,
  company_name text,
  mapping_status text not null default 'unmapped' check (mapping_status in ('mapped','unmapped','conflict','duplicate','merged')),
  merged_into_id uuid references public.crm_customer_identities(id) on delete set null,
  created_by uuid references public.platform_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, crm_contact_id)
);

create table if not exists public.crm_record_mappings (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'alfarooque',
  customer_identity_id uuid references public.crm_customer_identities(id) on delete cascade,
  source_system text not null,
  entity_type text not null,
  source_record_id text not null,
  local_record_id text,
  sync_status text not null default 'mapped' check (sync_status in ('mapped','pending','synced','failed','conflict','disabled')),
  source_updated_at timestamptz,
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, source_system, entity_type, source_record_id)
);

create table if not exists public.crm_sync_runs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.crm_integrations(id) on delete cascade,
  trigger_type text not null default 'manual' check (trigger_type in ('manual','scheduled','webhook','system')),
  direction text not null default 'pull',
  status text not null default 'pending' check (status in ('pending','running','success','partial','failed','cancelled')),
  records_total integer not null default 0,
  records_succeeded integer not null default 0,
  records_failed integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_summary text,
  requested_by uuid references public.platform_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_sync_records (
  id uuid primary key default gen_random_uuid(),
  sync_run_id uuid not null references public.crm_sync_runs(id) on delete cascade,
  entity_type text not null,
  external_id text,
  local_id text,
  idempotency_key text not null,
  status text not null check (status in ('pending','success','failed','skipped','conflict')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (idempotency_key)
);

create table if not exists public.crm_sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.crm_integrations(id) on delete cascade,
  mapping_id uuid references public.crm_record_mappings(id) on delete cascade,
  field_name text not null,
  local_value jsonb,
  external_value jsonb,
  status text not null default 'open' check (status in ('open','resolved_local','resolved_external','ignored')),
  resolved_by uuid references public.platform_users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_timeline_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'alfarooque',
  customer_identity_id uuid references public.crm_customer_identities(id) on delete cascade,
  source_system text not null,
  event_type text not null,
  source_record_id text,
  title text not null,
  description text,
  occurred_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references public.crm_integrations(id) on delete cascade,
  direction text not null check (direction in ('incoming','outgoing')),
  name text not null,
  endpoint_url text,
  event_types text[] not null default '{}',
  enabled boolean not null default true,
  secret_hash text,
  created_by uuid references public.platform_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_webhook_events (
  id uuid primary key default gen_random_uuid(),
  webhook_endpoint_id uuid references public.crm_webhook_endpoints(id) on delete set null,
  integration_id uuid references public.crm_integrations(id) on delete set null,
  event_type text not null,
  external_event_id text,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending','processing','success','failed','ignored')),
  attempts integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.crm_integration_audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'alfarooque',
  integration_id uuid references public.crm_integrations(id) on delete set null,
  actor_id uuid references public.platform_users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists crm_identity_email_idx on public.crm_customer_identities (tenant_id, normalized_email) where normalized_email is not null;
create index if not exists crm_identity_phone_idx on public.crm_customer_identities (tenant_id, normalized_phone) where normalized_phone is not null;
create index if not exists crm_mapping_customer_idx on public.crm_record_mappings (customer_identity_id, source_system);
create index if not exists crm_mapping_local_idx on public.crm_record_mappings (tenant_id, source_system, entity_type, local_record_id);
create index if not exists crm_sync_runs_status_idx on public.crm_sync_runs (integration_id, status, created_at desc);
create index if not exists crm_sync_records_run_idx on public.crm_sync_records (sync_run_id, status);
create index if not exists crm_conflicts_open_idx on public.crm_sync_conflicts (integration_id, created_at desc) where status = 'open';
create index if not exists crm_timeline_customer_idx on public.crm_timeline_events (customer_identity_id, occurred_at desc);
create index if not exists crm_webhook_status_idx on public.crm_webhook_events (status, received_at) where status in ('pending','failed');
create index if not exists crm_integration_audit_idx on public.crm_integration_audit_logs (integration_id, created_at desc);

alter table public.crm_integrations enable row level security;
alter table public.crm_customer_identities enable row level security;
alter table public.crm_record_mappings enable row level security;
alter table public.crm_sync_runs enable row level security;
alter table public.crm_sync_records enable row level security;
alter table public.crm_sync_conflicts enable row level security;
alter table public.crm_timeline_events enable row level security;
alter table public.crm_webhook_endpoints enable row level security;
alter table public.crm_webhook_events enable row level security;
alter table public.crm_integration_audit_logs enable row level security;

insert into public.crm_integrations (integration_key, name, provider, integration_type, enabled, status, sync_direction)
values
  ('smartlife','SmartLife','SmartLife','finance',false,'not_configured','pull'),
  ('quotation','QuotePro','AL FAROOQUE','erp',true,'connected','none'),
  ('projects','Projects','AL FAROOQUE','erp',true,'connected','none'),
  ('inventory','Inventory','AL FAROOQUE','erp',true,'connected','none'),
  ('cars','Cars','AL FAROOQUE','erp',true,'connected','none'),
  ('website','Website','AL FAROOQUE','website',true,'connected','pull'),
  ('email','Email','Email','communication',false,'not_configured','bidirectional'),
  ('whatsapp','WhatsApp','Meta','communication',false,'not_configured','bidirectional')
on conflict (tenant_id, integration_key) do nothing;
