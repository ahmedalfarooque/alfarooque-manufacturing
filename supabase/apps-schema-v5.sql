-- ═══════════════════════════════════════════════════════════════════
-- AL FAROOQUE — TrackFleet Maintenance Module upgrade
--
-- Fully ADDITIVE. Does not touch cars, car_maintenance (the periodic
-- "Maintenance Schedule" logic, unchanged), car_maintenance_log (the
-- old simple service log written by the Excel import — left in place
-- so import keeps working), drivers, or any other existing table.
--
-- This adds the rich "Maintenance" records module: shops, categories,
-- one row per completed job with full cost/invoice/technician detail,
-- and file attachments (invoices, before/during/after photos, docs).
-- Run once in Supabase Dashboard → SQL Editor → New query → Run.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.maintenance_shops (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  contact_person  text,
  mobile          text,
  telephone       text,
  email           text,
  address         text,
  city            text,
  vat_number      text,
  cr_number       text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_maintenance_shops_name on public.maintenance_shops(name);

create table if not exists public.maintenance_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.car_maintenance_records (
  id                uuid primary key default gen_random_uuid(),
  car_id            uuid not null references public.cars(id) on delete cascade,
  driver_id         uuid references public.drivers(id) on delete set null,
  maintenance_date  date not null default current_date,
  category          text not null,
  maintenance_type  text,
  shop_id           uuid references public.maintenance_shops(id) on delete set null,
  odometer_km       numeric(12,1),
  amount            numeric(12,2) not null default 0,
  currency          text not null default 'SAR',
  invoice_number    text,
  payment_status    text not null default 'Unpaid', -- Paid|Unpaid|Partial
  technician        text,
  warranty          text,
  work_performed    text,
  parts_changed     text,
  labor_details     text,
  notes             text,
  created_by        uuid references public.platform_users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_car_maintenance_records_car on public.car_maintenance_records(car_id, maintenance_date desc);
create index if not exists idx_car_maintenance_records_date on public.car_maintenance_records(maintenance_date desc);
create index if not exists idx_car_maintenance_records_shop on public.car_maintenance_records(shop_id);

create table if not exists public.car_maintenance_attachments (
  id            uuid primary key default gen_random_uuid(),
  record_id     uuid not null references public.car_maintenance_records(id) on delete cascade,
  slot          text not null default 'document', -- invoice_pdf|invoice_image|before|during|after|document
  file_name     text not null,
  storage_path  text not null,
  url           text not null,
  uploaded_by   uuid references public.platform_users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_car_maintenance_attachments_record on public.car_maintenance_attachments(record_id);

drop trigger if exists trg_maintenance_shops_touch on public.maintenance_shops;
create trigger trg_maintenance_shops_touch before update on public.maintenance_shops
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_car_maintenance_records_touch on public.car_maintenance_records;
create trigger trg_car_maintenance_records_touch before update on public.car_maintenance_records
  for each row execute function public.touch_updated_at();

insert into storage.buckets (id, name, public)
values ('maintenance-documents', 'maintenance-documents', true)
on conflict (id) do nothing;

alter table public.maintenance_shops           enable row level security;
alter table public.maintenance_categories      enable row level security;
alter table public.car_maintenance_records     enable row level security;
alter table public.car_maintenance_attachments enable row level security;

insert into public.maintenance_categories (name, is_default) values
  ('Engine Oil', true), ('Oil Filter', true), ('Air Filter', true), ('AC Filter', true),
  ('Fuel Filter', true), ('Brake Pads', true), ('Brake Disc', true), ('Tires', true),
  ('Battery', true), ('AC Repair', true), ('Engine Repair', true), ('Suspension', true),
  ('Transmission', true), ('Electrical', true), ('Body Repair', true), ('Paint', true),
  ('Accident Repair', true), ('General Service', true), ('Other', true)
on conflict (name) do nothing;
-- ═══════════════════════════════════════════════════════════════════
