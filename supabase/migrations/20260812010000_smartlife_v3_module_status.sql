-- Per-module SmartERP V3 sync status, so the Sync Center can show each resource's
-- own connection/permission/error state instead of one all-or-nothing integration status.
-- Reuses the existing crm_integrations / crm_sync_runs / crm_sync_records platform — additive only.
create table if not exists public.crm_integration_module_status (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'alfarooque',
  integration_id uuid not null references public.crm_integrations(id) on delete cascade,
  module_key text not null,
  status text not null default 'pending' check (status in ('connected','permission_required','error','pending','not_configured')),
  records_read integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  last_synced_at timestamptz,
  last_attempted_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  unique (tenant_id, integration_id, module_key)
);

create index if not exists crm_integration_module_status_integration_idx
  on public.crm_integration_module_status (integration_id, module_key);

alter table public.crm_integration_module_status enable row level security;
revoke all on table public.crm_integration_module_status from anon, authenticated;
grant select, insert, update, delete on table public.crm_integration_module_status to service_role;
drop policy if exists "Server-only module status access" on public.crm_integration_module_status;
create policy "Server-only module status access" on public.crm_integration_module_status for all to service_role using (true) with check (true);
