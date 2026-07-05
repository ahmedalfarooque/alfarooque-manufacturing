-- ═══════════════════════════════════════════════════════════════════
-- AL FAROOQUE — Cars Tracking + Project Management apps
--
-- Fully ADDITIVE — creates brand-new tables only. Does NOT alter,
-- rename, or drop anything in schema.sql (products, orders, admin_users,
-- customers, etc.). Safe to run against the SAME Supabase project that
-- powers the live storefront/admin dashboard; nothing here touches that
-- data. Run once in Supabase Dashboard → SQL Editor → New query → Run
-- (same workflow as schema.sql — see AUTH_SETUP.md).
--
-- These tables back TWO separate, independently-deployed Next.js apps
-- (apps/cars, apps/projects) that are proxied under alfarooque.com/cars
-- and /projects via vercel.json rewrites. They share one identity
-- system (platform_users/otp/sessions) since the same person (or team)
-- administers both, but each app's session is scoped by an `app` column
-- so a Cars session and a Projects session are independent even though
-- the underlying user record is shared.
-- ═══════════════════════════════════════════════════════════════════
create extension if not exists pgcrypto;

-- ── Shared identity for apps/cars + apps/projects (NOT the same table
--    as public.admin_users — kept fully isolated per the isolation
--    requirement) ──────────────────────────────────────────────────
create table if not exists public.platform_users (
  id                    uuid primary key default gen_random_uuid(),
  email                 text unique not null,
  password_hash         text not null,
  full_name             text,
  role                  text not null default 'viewer', -- admin|viewer
  is_active             boolean not null default true,
  must_change_password  boolean not null default true,
  created_at            timestamptz not null default now(),
  last_login_at         timestamptz
);

create table if not exists public.platform_otp_codes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.platform_users(id) on delete cascade,
  app           text not null default 'cars',      -- cars|projects — which login page issued this
  code_hash     text not null,
  purpose       text not null default 'login',
  attempt_count int not null default 0,
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_platform_otp_user on public.platform_otp_codes(user_id, created_at desc);

create table if not exists public.platform_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.platform_users(id) on delete cascade,
  app         text not null default 'cars',        -- cars|projects — session is app-scoped
  token_hash  text not null unique,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz
);
create index if not exists idx_platform_sessions_user on public.platform_sessions(user_id);

create table if not exists public.platform_login_attempts (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  app        text not null default 'cars',
  ip         text,
  success    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_platform_login_attempts_email on public.platform_login_attempts(email, created_at desc);

-- ── Cars Tracking System ──────────────────────────────────────────
-- Superset of the GPS-fleet-style fields (status/location/last_update,
-- used by the live dashboard demo) AND the real odometer/maintenance
-- fields from the actual AL FAROOQUE fleet workbook (plate/make/model/
-- year/color/VIN/oil type & viscosity/current KM) so the Excel import
-- of the real 30-vehicle fleet sheet maps cleanly onto this table.
create table if not exists public.cars (
  id                uuid primary key default gen_random_uuid(),
  vehicle_number    text unique not null,          -- plate number (رقم اللوحة)
  name              text,                          -- display name, e.g. "Suzuki Pickup"
  make              text,                          -- الماركة
  model             text,                          -- الطراز
  year              int,                           -- السنة
  color             text,                          -- اللون
  serial_number     text,                          -- الرقم التسلسلي / VIN
  type              text default 'Vehicle',        -- Truck|SUV|Car|Van|...
  fuel_type         text default 'Diesel',
  driver            text,
  status            text not null default 'Idle',  -- Running|Idle|Stopped|Offline
  condition_status  text default 'Valid',           -- الحالة (روadworthy/valid)
  oil_type          text,                           -- نوع الزيت
  oil_viscosity     text,                           -- اللزوجة
  oil_capacity_l    numeric(5,2),                   -- العلب (oil capacity, litres)
  current_km        numeric(12,1) not null default 0,
  distance_km       numeric(12,1) not null default 0, -- distance this period, for dashboard "Top by Distance"
  location          text,
  last_update       timestamptz not null default now(),
  notes             text,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_cars_status on public.cars(status);

-- Periodic maintenance tracker (matches "الصيانات الدورية" — per
-- maintenance-item interval tracking, drives the "Maintenance Due"
-- dashboard widget). next_due_km/remaining/status are computed at
-- query time from cars.current_km, not stored, so they never go stale.
create table if not exists public.car_maintenance (
  id                uuid primary key default gen_random_uuid(),
  car_id            uuid not null references public.cars(id) on delete cascade,
  maintenance_type  text not null,                 -- e.g. "Engine Oil", "Oil Filter"
  last_service_km   numeric(12,1) not null default 0,
  interval_km       numeric(12,1) not null default 10000,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_car_maintenance_car on public.car_maintenance(car_id);

-- Service history log (matches "سجل الصيانة" — one row per completed
-- service, with cost, so cost-analysis views/exports are possible).
create table if not exists public.car_maintenance_log (
  id             uuid primary key default gen_random_uuid(),
  car_id         uuid not null references public.cars(id) on delete cascade,
  service_date   date not null default current_date,
  description    text,
  workshop       text,
  cost           numeric(12,2) default 0,
  km_at_service  numeric(12,1),
  status         text default 'Completed',
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists idx_car_maintenance_log_car on public.car_maintenance_log(car_id, service_date desc);

create table if not exists public.car_alerts (
  id          uuid primary key default gen_random_uuid(),
  car_id      uuid references public.cars(id) on delete cascade,
  type        text not null,                       -- high_speed|geofence|maintenance|low_fuel|system
  title       text not null,
  body        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists idx_car_alerts_created on public.car_alerts(created_at desc);

create table if not exists public.car_trips (
  id          uuid primary key default gen_random_uuid(),
  car_id      uuid references public.cars(id) on delete cascade,
  driver      text,
  from_place  text,
  to_place    text,
  distance_km numeric(10,1),
  duration_min int,
  started_at  timestamptz not null default now()
);
create index if not exists idx_car_trips_started on public.car_trips(started_at desc);

drop trigger if exists trg_cars_touch on public.cars;
create trigger trg_cars_touch before update on public.cars
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_car_maintenance_touch on public.car_maintenance;
create trigger trg_car_maintenance_touch before update on public.car_maintenance
  for each row execute function public.touch_updated_at();

-- ── Project Management System ─────────────────────────────────────
create table if not exists public.pm_projects (
  id            uuid primary key default gen_random_uuid(),
  customer_name text not null,
  company_name  text,
  project_name  text not null,
  value         numeric(14,2) not null default 0,
  start_date    date,
  end_date      date,
  status        text not null default 'Upcoming',  -- Running|Completed|Upcoming|On Hold
  progress      int not null default 0,             -- 0-100
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_pm_projects_status on public.pm_projects(status);

create table if not exists public.pm_project_logs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.pm_projects(id) on delete cascade,
  activity    text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_pm_project_logs_project on public.pm_project_logs(project_id, created_at desc);

create table if not exists public.pm_project_documents (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.pm_projects(id) on delete cascade,
  file_name    text not null,
  storage_path text not null,     -- Supabase Storage object path
  uploaded_by  uuid references public.platform_users(id) on delete set null,
  created_at   timestamptz not null default now()
);

drop trigger if exists trg_pm_projects_touch on public.pm_projects;
create trigger trg_pm_projects_touch before update on public.pm_projects
  for each row execute function public.touch_updated_at();

-- ═══════════════════════════════════════════════════════════════════
-- RLS — every table here is service-role-only (no policies = deny all
-- for anon/authenticated), same convention as schema.sql. Both apps
-- talk to Supabase exclusively through their server-side API routes
-- using the service role key — never from the browser.
-- ═══════════════════════════════════════════════════════════════════
alter table public.platform_users          enable row level security;
alter table public.platform_otp_codes      enable row level security;
alter table public.platform_sessions       enable row level security;
alter table public.platform_login_attempts enable row level security;
alter table public.cars                    enable row level security;
alter table public.car_maintenance         enable row level security;
alter table public.car_maintenance_log     enable row level security;
alter table public.car_alerts              enable row level security;
alter table public.car_trips               enable row level security;
alter table public.pm_projects             enable row level security;
alter table public.pm_project_logs         enable row level security;
alter table public.pm_project_documents    enable row level security;

-- ── Seed the one shared admin account for both new apps. Safe to
--    re-run (on conflict do nothing). Change the password after first
--    login — must_change_password is already true. ──
insert into public.platform_users (email, password_hash, full_name, role, must_change_password)
values (
  'arshad@alfarooque.com',
  crypt('123Abc45@@@', gen_salt('bf', 12)),
  'Arshad',
  'admin',
  true
)
on conflict (email) do nothing;
-- ═══════════════════════════════════════════════════════════════════
