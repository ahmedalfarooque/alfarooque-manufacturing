-- Keep qt_quotations.project_id for its legacy qt_projects relationship.
-- The Projects application correlation uses a separate, correctly typed FK.
alter table public.qt_quotations
  add column if not exists pm_project_id uuid references public.pm_projects(id) on delete set null;

update public.qt_quotations q
set pm_project_id = r.project_id
from public.project_requests r
where r.quotation_id = q.id
  and r.project_id is not null
  and q.pm_project_id is null;

create index if not exists qt_quotations_pm_project_idx
  on public.qt_quotations (pm_project_id) where pm_project_id is not null;

notify pgrst, 'reload schema';
