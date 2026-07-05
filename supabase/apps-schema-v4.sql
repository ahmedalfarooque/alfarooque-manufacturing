-- ═══════════════════════════════════════════════════════════════════
-- AL FAROOQUE — Cars app, schema v4 (additive)
-- Run AFTER apps-schema.sql and apps-schema-v2.sql. Adds Driver
-- Management + enriches the cars table with insurance/registration/
-- service tracking. Does not alter or drop anything in earlier schema
-- files or touch existing vehicle data — every new column is nullable.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.drivers (
  id                    uuid primary key default gen_random_uuid(),
  full_name             text not null,
  full_name_ar          text,
  employee_id           text,
  phone                 text,
  whatsapp              text,
  email                 text,
  nationality           text,
  date_of_birth         date,
  blood_group           text,
  address               text,
  emergency_contact     text,
  emergency_phone       text,
  department            text,
  designation           text,
  joining_date          date,
  status                text not null default 'Active', -- Active|Inactive|On Leave|Terminated
  license_number        text,
  license_type          text,
  license_issue_date    date,
  license_expiry_date   date,
  iqama_number          text,
  iqama_expiry_date     date,
  passport_number       text,
  passport_expiry_date  date,
  medical_expiry_date   date,
  notes                 text,
  assigned_car_id       uuid references public.cars(id) on delete set null,
  experience_years      numeric(4,1),
  driving_category      text,
  profile_photo_url     text,
  license_front_url     text,
  license_back_url      text,
  iqama_front_url       text,
  iqama_back_url        text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_drivers_full_name on public.drivers(full_name);
create index if not exists idx_drivers_assigned_car on public.drivers(assigned_car_id);
alter table public.drivers enable row level security;

drop trigger if exists trg_drivers_touch on public.drivers;
create trigger trg_drivers_touch before update on public.drivers
  for each row execute function public.touch_updated_at();

create table if not exists public.driver_activity_log (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references public.drivers(id) on delete cascade,
  activity    text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_driver_activity_driver on public.driver_activity_log(driver_id, created_at desc);
alter table public.driver_activity_log enable row level security;

-- Storage bucket for driver photos/documents — public read (internal
-- HR records, not publicly discoverable since URLs are unguessable
-- UUIDs), writes only via the server's service-role key.
insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', true)
on conflict (id) do nothing;

-- ── Vehicle enrichment — insurance, registration, identifiers,
--    service tracking, assigned driver, purchase info ──
alter table public.cars add column if not exists insurance_company text;
alter table public.cars add column if not exists insurance_number text;
alter table public.cars add column if not exists insurance_expiry date;
alter table public.cars add column if not exists registration_expiry date;
alter table public.cars add column if not exists vin_number text;
alter table public.cars add column if not exists engine_number text;
alter table public.cars add column if not exists last_service_date date;
alter table public.cars add column if not exists next_service_date date;
alter table public.cars add column if not exists assigned_driver_id uuid references public.drivers(id) on delete set null;
alter table public.cars add column if not exists purchase_date date;
alter table public.cars add column if not exists purchase_cost numeric(12,2);
create index if not exists idx_cars_assigned_driver on public.cars(assigned_driver_id);
-- ═══════════════════════════════════════════════════════════════════
