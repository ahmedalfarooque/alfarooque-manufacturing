-- Quotation -> Production approval -> Customer decision -> Contract -> Project.
-- Additive and idempotent: existing records and legacy states are preserved.

alter table public.qt_quotations
  drop constraint if exists qt_quotations_status_check;

alter table public.qt_quotations
  add constraint qt_quotations_status_check check (status in (
    'draft', 'submitted', 'waiting_production_approval',
    'production_approved', 'production_rejected',
    'customer_approved', 'customer_rejected',
    'contracted', 'project_created',
    -- Existing values remain valid for historical rows and revisions.
    'pending_approval', 'approved', 'sent', 'accepted', 'rejected',
    'expired', 'superseded', 'cancelled', 'started',
    'customer_accepted', 'contract_submitted', 'contract_accepted',
    'project_sent', 'project_rejected'
  ));

-- A project carries the source quotation correlation directly. The unique
-- index is the database-level idempotency guarantee: one quotation can
-- create/update one project even if the contract action is retried.
alter table public.pm_projects
  add column if not exists quotation_id uuid references public.qt_quotations(id) on delete set null;

update public.pm_projects p
set quotation_id = r.quotation_id
from public.project_requests r
where r.project_id = p.id
  and p.quotation_id is null;

create unique index if not exists pm_projects_quotation_uidx
  on public.pm_projects (quotation_id)
  where quotation_id is not null;

notify pgrst, 'reload schema';
