-- Denormalized sync-back columns so apps/quotation can show the
-- Projects-side review status (and later, live project status) without
-- an extra cross-table join on every list-page fetch. Written directly
-- by apps/projects' quotation-requests PATCH handler and start-project
-- endpoint (same Postgres instance, no HTTP call needed).
-- Idempotent: safe to re-run.

alter table qt_quotations
  add column if not exists project_status text,
  add column if not exists project_request_id uuid references public.project_requests(id),
  add column if not exists project_id uuid references public.pm_projects(id);

notify pgrst, 'reload schema';
