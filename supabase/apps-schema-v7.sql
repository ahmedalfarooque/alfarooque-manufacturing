-- ═══════════════════════════════════════════════════════════════════
-- AL FAROOQUE — ProTrack: 3-Tier Permissions, Workflow Expansion,
-- Notifications, Users Management
--
-- Fully ADDITIVE. Does not touch cars/*, does not alter/remove any
-- existing column or row, does not add a CHECK constraint on
-- platform_users.role (it's a plain text column already — 'admin' and
-- 'viewer' keep working exactly as before; 'external' is just a new
-- value the application now also accepts). Run once in Supabase
-- Dashboard → SQL Editor → New query → Run.
-- ═══════════════════════════════════════════════════════════════════

-- Users: richer profile fields for the new Users management page.
alter table public.platform_users add column if not exists phone text;
alter table public.platform_users add column if not exists department text;
alter table public.platform_users add column if not exists photo_url text;
alter table public.platform_users add column if not exists company text;
alter table public.platform_users add column if not exists status text not null default 'Active'; -- Active|Inactive|Blocked
alter table public.platform_users add column if not exists otp_login_enabled boolean not null default true;

-- Purchase Requests: one new field + attachment categorization.
alter table public.pm_purchase_requests add column if not exists expected_date date;
alter table public.pm_purchase_request_attachments add column if not exists label text; -- Image|PDF|Invoice|Quotation|Other

-- Purchase Request status history (timeline / approval history)
create table if not exists public.pm_purchase_request_status_history (
  id                    uuid primary key default gen_random_uuid(),
  purchase_request_id   uuid not null references public.pm_purchase_requests(id) on delete cascade,
  from_status           text,
  to_status             text not null,
  changed_by            uuid references public.platform_users(id) on delete set null,
  note                  text,
  created_at            timestamptz not null default now()
);
create index if not exists idx_pr_status_history_request on public.pm_purchase_request_status_history(purchase_request_id, created_at desc);

-- Purchase Request comments
create table if not exists public.pm_purchase_request_comments (
  id                    uuid primary key default gen_random_uuid(),
  purchase_request_id   uuid not null references public.pm_purchase_requests(id) on delete cascade,
  author_id             uuid references public.platform_users(id) on delete set null,
  comment               text not null,
  created_at            timestamptz not null default now()
);
create index if not exists idx_pr_comments_request on public.pm_purchase_request_comments(purchase_request_id, created_at asc);

-- Daily Updates: title/need-help/approval workflow.
alter table public.pm_daily_updates add column if not exists title text;
alter table public.pm_daily_updates add column if not exists need_help boolean not null default false;
alter table public.pm_daily_updates add column if not exists status text not null default 'Pending'; -- Pending|Approved|Rejected|Need Revision|Published
alter table public.pm_daily_updates add column if not exists reviewed_by uuid references public.platform_users(id) on delete set null;
alter table public.pm_daily_updates add column if not exists reviewed_at timestamptz;

-- Notifications (admin dashboard bell/panel)
create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.platform_users(id) on delete cascade, -- who should see it (an admin)
  type          text not null, -- 'purchase_request' | 'daily_update' | ...
  title         text not null,
  body          text,
  link          text,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_notifications_user on public.notifications(user_id, is_read, created_at desc);

alter table public.pm_purchase_request_status_history enable row level security;
alter table public.pm_purchase_request_comments        enable row level security;
alter table public.notifications                       enable row level security;
-- No policies — accessed only via the SUPABASE_SERVICE_ROLE_KEY server client, same as every other table in this schema.
-- ═══════════════════════════════════════════════════════════════════
