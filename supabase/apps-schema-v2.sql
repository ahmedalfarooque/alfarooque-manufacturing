-- ═══════════════════════════════════════════════════════════════════
-- AL FAROOQUE — Cars/Projects apps, schema v2 (additive)
-- Run AFTER apps-schema.sql. Adds tables needed for the expanded
-- dashboard fidelity + new nav pages (Fuel Management, Activity Log,
-- the "last 7 days" status chart). Does not alter anything in
-- schema.sql or apps-schema.sql.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.fuel_log (
  id            uuid primary key default gen_random_uuid(),
  car_id        uuid not null references public.cars(id) on delete cascade,
  filled_at     date not null default current_date,
  liters        numeric(10,2) not null default 0,
  cost          numeric(12,2) not null default 0,
  odometer_km   numeric(12,1),
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_fuel_log_car on public.fuel_log(car_id, filled_at desc);
alter table public.fuel_log enable row level security;

-- Daily snapshot of fleet status counts — written once per day (or on
-- every status change) so the "Real-Time Vehicle Status" line chart
-- has genuine history to plot instead of inventing numbers. Until this
-- has accumulated a few days of real data, the chart legitimately has
-- little to show — that's correct, not a bug.
create table if not exists public.car_status_snapshots (
  id            uuid primary key default gen_random_uuid(),
  snapshot_date date not null default current_date,
  running       int not null default 0,
  idle          int not null default 0,
  stopped       int not null default 0,
  offline       int not null default 0,
  created_at    timestamptz not null default now(),
  unique (snapshot_date)
);
alter table public.car_status_snapshots enable row level security;

-- Shared activity/audit log for both apps (app column distinguishes
-- Cars vs Projects entries in one shared table, same identity model as
-- platform_users/sessions).
create table if not exists public.platform_activity_log (
  id          uuid primary key default gen_random_uuid(),
  app         text not null default 'cars',      -- cars|projects
  user_id     uuid references public.platform_users(id) on delete set null,
  user_email  text,
  action      text not null,                      -- e.g. "vehicle.create", "login.success"
  entity_type text,
  entity_id   text,
  details     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists idx_platform_activity_created on public.platform_activity_log(created_at desc);
alter table public.platform_activity_log enable row level security;
-- ═══════════════════════════════════════════════════════════════════
