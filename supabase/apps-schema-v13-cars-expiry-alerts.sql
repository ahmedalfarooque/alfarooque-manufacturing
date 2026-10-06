-- ═══════════════════════════════════════════════════════════════════
-- AL FAROOQUE — Cars app, schema v13 (additive, idempotent)
-- Periodic Vehicle Inspection + insurance start date + daily expiry-alert
-- email system with PER-ALERT-TYPE configuration. Run AFTER
-- apps-schema-v4.sql (insurance_* columns) and apps-schema.sql (cars).
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

-- ── Per-alert-type settings (exactly one row per type) ─────────────
-- enabled             : the alert type is tracked by the daily job at all
-- auto_notify_enabled : the daily job emails this type's recipients
-- email_language      : template language for this type's emails
create table if not exists public.car_alert_type_settings (
  alert_type           text primary key check (alert_type in ('insurance', 'inspection')),
  enabled              boolean not null default true,
  auto_notify_enabled  boolean not null default true,
  email_language       text    not null default 'en' check (email_language in ('en', 'ar', 'both')),
  updated_by           text,
  updated_at           timestamptz not null default now()
);
insert into public.car_alert_type_settings (alert_type) values ('insurance'), ('inspection') on conflict (alert_type) do nothing;
alter table public.car_alert_type_settings enable row level security;

-- ── Alert recipients, per alert type ───────────────────────────────
-- One row per (email, alert type). The same address may subscribe to
-- both types; it then receives ONE combined digest per day. Stored
-- lower-cased; the unique index makes duplicates impossible even if two
-- admins add the same address at the same moment.
create table if not exists public.car_alert_recipients (
  id          uuid primary key default gen_random_uuid(),
  alert_type  text not null check (alert_type in ('insurance', 'inspection')),
  email       text not null check (email = lower(email) and position('@' in email) > 1),
  name        text,
  enabled     boolean not null default true,
  created_by  text,
  created_at  timestamptz not null default now()
);
create unique index if not exists uq_car_alert_recipients_type_email on public.car_alert_recipients(alert_type, email);
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

-- ── Automatic delivery log: one row per (alert, recipient, day) ────
-- The unique constraint is the idempotency guarantee: the job claims a
-- row BEFORE sending, so two overlapping runs (cron retry, manual
-- trigger) can never both send the same alert to the same recipient on
-- the same day. Manual TEST sends are NOT recorded here (see
-- car_alert_test_sends) so they never block or count as real deliveries.
create table if not exists public.car_expiry_alert_deliveries (
  id            uuid primary key default gen_random_uuid(),
  alert_id      uuid not null references public.car_expiry_alerts(id) on delete cascade,
  recipient     text not null,
  sent_on       date not null,
  status        text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_id   text,
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (alert_id, recipient, sent_on)
);
create index if not exists idx_car_expiry_deliveries_day on public.car_expiry_alert_deliveries(sent_on desc);
alter table public.car_expiry_alert_deliveries enable row level security;

-- ── Daily job run log (one row per real run; dry runs are not logged) ─
create table if not exists public.car_alert_job_runs (
  id                  uuid primary key default gen_random_uuid(),
  started_at          timestamptz not null default now(),
  finished_at         timestamptz,
  run_date            date not null,
  trigger             text not null check (trigger in ('cron', 'manual')),
  status              text not null default 'running' check (status in ('running', 'ok', 'partial', 'failed')),
  active_alerts       int not null default 0,
  recipients          int not null default 0,
  emails_sent         int not null default 0,
  emails_failed       int not null default 0,
  duplicates_skipped  int not null default 0,
  resolved            int not null default 0,
  error               text
);
create index if not exists idx_car_alert_job_runs_started on public.car_alert_job_runs(started_at desc);
alter table public.car_alert_job_runs enable row level security;

-- ── Manual test-notification log (separate from real deliveries) ──
create table if not exists public.car_alert_test_sends (
  id            uuid primary key default gen_random_uuid(),
  alert_type    text not null check (alert_type in ('insurance', 'inspection')),
  recipient     text not null,
  sent_by       text,
  status        text not null check (status in ('sent', 'failed')),
  provider_id   text,
  error         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_car_alert_test_sends_created on public.car_alert_test_sends(created_at desc);
alter table public.car_alert_test_sends enable row level security;
