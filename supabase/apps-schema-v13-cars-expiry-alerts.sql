-- ═══════════════════════════════════════════════════════════════════
-- AL FAROOQUE — Cars app, schema v13 (additive, idempotent)
-- Periodic Vehicle Inspection + insurance start date + daily expiry-alert
-- email system. Run AFTER apps-schema-v4.sql (insurance_* columns) and
-- apps-schema.sql (cars / car_alerts).
--
-- Additive only: no existing column/table is altered or dropped, and no
-- existing row is changed. All new vehicle columns are nullable, so every
-- existing vehicle simply shows "Not set" until a real date is entered.
-- RLS is enabled with no policies, same as the other app tables — the
-- Cars app reads/writes these through the server-side service-role key
-- only; nothing here is exposed to anon/authenticated clients.
-- ═══════════════════════════════════════════════════════════════════

-- ── Vehicle fields ─────────────────────────────────────────────────
alter table public.cars add column if not exists insurance_start_date           date;
alter table public.cars add column if not exists periodic_inspection_last_date  date;
alter table public.cars add column if not exists periodic_inspection_expiry     date;
create index if not exists idx_cars_insurance_expiry on public.cars(insurance_expiry) where insurance_expiry is not null;
create index if not exists idx_cars_inspection_expiry on public.cars(periodic_inspection_expiry) where periodic_inspection_expiry is not null;

-- ── Alert settings (exactly one row) ───────────────────────────────
create table if not exists public.car_alert_settings (
  id                          boolean primary key default true check (id),
  insurance_alerts_enabled    boolean not null default true,
  inspection_alerts_enabled   boolean not null default true,
  daily_notification_enabled  boolean not null default true,
  email_language              text    not null default 'en' check (email_language in ('en', 'ar', 'both')),
  updated_by                  text,
  updated_at                  timestamptz not null default now()
);
insert into public.car_alert_settings (id) values (true) on conflict (id) do nothing;
alter table public.car_alert_settings enable row level security;

-- ── Alert recipients ───────────────────────────────────────────────
-- Stored lower-cased; the unique index makes duplicates impossible even
-- if two admins add the same address at the same moment.
create table if not exists public.car_alert_recipients (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (email = lower(email) and position('@' in email) > 1),
  enabled     boolean not null default true,
  created_by  text,
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_car_alert_recipients_email on public.car_alert_recipients(email);
alter table public.car_alert_recipients enable row level security;

-- ── Alert state: one row per (vehicle, alert type, expiry date) ────
-- A renewal changes the expiry date, which produces a NEW key; the old
-- row is closed ('resolved') by the daily reconcile, so notification
-- history never carries over to a different expiry date.
create table if not exists public.car_expiry_alerts (
  id                uuid primary key default gen_random_uuid(),
  car_id            uuid not null references public.cars(id) on delete cascade,
  alert_type        text not null check (alert_type in ('insurance', 'inspection')),
  expiry_date       date not null,
  state             text not null default 'active' check (state in ('active', 'resolved')),
  first_detected_on date not null,
  last_sent_on      date,
  resolved_on       date,
  resolved_reason   text check (resolved_reason in ('renewed', 'date_removed', 'vehicle_inactive')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (car_id, alert_type, expiry_date)
);
create index if not exists idx_car_expiry_alerts_state on public.car_expiry_alerts(state, alert_type);
alter table public.car_expiry_alerts enable row level security;

-- ── Delivery log: one row per (alert, recipient, calendar day) ─────
-- The unique constraint is the idempotency guarantee: the job claims a
-- row BEFORE sending, so two overlapping runs (cron retry, manual
-- trigger) can never both send the same alert to the same recipient on
-- the same day.
create table if not exists public.car_expiry_alert_deliveries (
  id            uuid primary key default gen_random_uuid(),
  alert_id      uuid not null references public.car_expiry_alerts(id) on delete cascade,
  recipient     text not null,
  sent_on       date not null,
  status        text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'mocked')),
  provider_id   text,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (alert_id, recipient, sent_on)
);
create index if not exists idx_car_expiry_deliveries_day on public.car_expiry_alert_deliveries(sent_on desc);
alter table public.car_expiry_alert_deliveries enable row level security;
