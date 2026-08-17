-- Extend the existing cross-app access grant; do not duplicate identity or
-- application-access storage. app_role uses QuotePro's authoritative role list.
alter table public.app_permissions add column if not exists app_role text;
alter table public.app_permissions add column if not exists module_access jsonb not null default '{}'::jsonb;

update public.app_permissions set app_role = 'readonly' where app_role is null;
alter table public.app_permissions alter column app_role set default 'readonly';
alter table public.app_permissions alter column app_role set not null;

alter table public.app_permissions drop constraint if exists app_permissions_app_role_check;
alter table public.app_permissions add constraint app_permissions_app_role_check
  check (app_role in ('admin','manager','sales','estimator','accountant','production','readonly'));

-- No role+app+module permission store existed. This single table is shared by
-- all six apps and stores only role policy, not duplicate users or app grants.
create table if not exists public.erp_role_permissions (
  id uuid primary key default gen_random_uuid(),
  app_id text not null check (app_id in ('quotation','projects','cars','inventory','accounting','crm')),
  role text not null check (role in ('admin','manager','sales','estimator','accountant','production','readonly')),
  module_id text not null,
  can_view boolean not null default false,
  can_add boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  miscellaneous jsonb not null default '{}'::jsonb,
  updated_by uuid references public.platform_users(id),
  updated_at timestamptz not null default now(),
  unique (app_id, role, module_id)
);

create index if not exists idx_erp_role_permissions_app_role
  on public.erp_role_permissions(app_id, role);

-- This public-schema table is accessed only by authenticated server routes
-- through the service role. Keep it closed to browser Data API clients.
alter table public.erp_role_permissions enable row level security;
grant select, insert, update, delete on public.erp_role_permissions to service_role;

notify pgrst, 'reload schema';
