-- ═══════════════════════════════════════════════════════════════════
-- AL FAROOQUE — ProTrack: Assigned Users, Purchase Requests, Daily Updates
--
-- Fully ADDITIVE. Does not touch cars/*, platform_sessions,
-- platform_activity_log, customers, or any existing pm_projects /
-- pm_project_logs / pm_project_documents row or column — only adds
-- one nullable column to platform_users and six new tables.
-- Run once in Supabase Dashboard → SQL Editor → New query → Run.
-- ═══════════════════════════════════════════════════════════════════

-- Optional "position"/job-title field for users (e.g. "Project Engineer")
alter table public.platform_users add column if not exists position text;

-- Many-to-many: which users are assigned to which project
create table if not exists public.pm_project_assignees (
  project_id  uuid not null references public.pm_projects(id) on delete cascade,
  user_id     uuid not null references public.platform_users(id) on delete cascade,
  assigned_by uuid references public.platform_users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists idx_pm_project_assignees_user on public.pm_project_assignees(user_id);

-- Purchase Requests
create table if not exists public.pm_purchase_requests (
  id                    uuid primary key default gen_random_uuid(),
  project_id            uuid not null references public.pm_projects(id) on delete cascade,
  requested_by          uuid references public.platform_users(id) on delete set null,
  request_date          date not null default current_date,
  supplier              text,
  material_description  text not null,
  material_list         text,
  quantity              numeric,
  unit                  text,
  estimated_price       numeric(14,2),
  required_date         date,
  priority              text not null default 'Normal' check (priority in ('Normal','Urgent','Critical')),
  status                text not null default 'Pending' check (status in ('Pending','Approved','Rejected','Ordered','Delivered','Completed')),
  remarks               text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_pm_purchase_requests_project on public.pm_purchase_requests(project_id, created_at desc);
create index if not exists idx_pm_purchase_requests_status  on public.pm_purchase_requests(status);

create table if not exists public.pm_purchase_request_attachments (
  id                    uuid primary key default gen_random_uuid(),
  purchase_request_id   uuid not null references public.pm_purchase_requests(id) on delete cascade,
  file_name             text not null,
  storage_path          text not null,
  uploaded_by           uuid references public.platform_users(id) on delete set null,
  created_at            timestamptz not null default now()
);
create index if not exists idx_pm_pr_attachments_request on public.pm_purchase_request_attachments(purchase_request_id);

-- Daily Updates
create table if not exists public.pm_daily_updates (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.pm_projects(id) on delete cascade,
  author_id      uuid references public.platform_users(id) on delete set null,
  update_date    date not null default current_date,
  weather        text,
  progress_pct   int check (progress_pct between 0 and 100),
  todays_work    text,
  description    text,
  issues         text,
  tomorrow_plan  text,
  remarks        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_pm_daily_updates_project on public.pm_daily_updates(project_id, update_date desc);
create index if not exists idx_pm_daily_updates_date    on public.pm_daily_updates(update_date desc);

create table if not exists public.pm_daily_update_attachments (
  id               uuid primary key default gen_random_uuid(),
  daily_update_id  uuid not null references public.pm_daily_updates(id) on delete cascade,
  file_name        text not null,
  storage_path     text not null,
  uploaded_by      uuid references public.platform_users(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists idx_pm_du_attachments_update on public.pm_daily_update_attachments(daily_update_id);

drop trigger if exists trg_pm_purchase_requests_touch on public.pm_purchase_requests;
create trigger trg_pm_purchase_requests_touch before update on public.pm_purchase_requests
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_pm_daily_updates_touch on public.pm_daily_updates;
create trigger trg_pm_daily_updates_touch before update on public.pm_daily_updates
  for each row execute function public.touch_updated_at();

alter table public.pm_project_assignees          enable row level security;
alter table public.pm_purchase_requests          enable row level security;
alter table public.pm_purchase_request_attachments enable row level security;
alter table public.pm_daily_updates              enable row level security;
alter table public.pm_daily_update_attachments   enable row level security;
-- No policies added — this app only ever accesses these tables via the
-- SUPABASE_SERVICE_ROLE_KEY server-side client (lib/db.js), same as
-- every other pm_*/car_* table already in this schema.
-- ═══════════════════════════════════════════════════════════════════
