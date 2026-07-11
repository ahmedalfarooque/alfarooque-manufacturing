-- Quotation -> Projects handoff. Created when a quotation's status
-- reaches 'started' and the user clicks "Send to Projects". Reviewed
-- by Projects admins (accept/hold/reject); once accepted/on-hold, a
-- real pm_projects row can be created from it ("Project Start").
-- Cross-app table: referenced by both apps/quotation (qt_quotations)
-- and apps/projects (pm_projects), living in the shared public schema.
-- Idempotent: safe to re-run.

create table if not exists public.project_requests (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references qt_quotations(id),
  quote_number text not null,
  customer_id uuid references public.customers(id),
  amount numeric(14,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','accepted','on_hold','rejected')),
  project_id uuid references public.pm_projects(id),
  requested_by uuid references public.platform_users(id),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one active (non-rejected) request per quotation at a time —
-- prevents duplicate double-click sends; a rejected request can be
-- superseded by a fresh one if the quotation is re-submitted.
create unique index if not exists project_requests_active_uidx
  on public.project_requests (quotation_id) where status <> 'rejected';

create index if not exists project_requests_status_idx on public.project_requests (status);

notify pgrst, 'reload schema';
