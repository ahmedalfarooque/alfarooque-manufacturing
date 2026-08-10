-- Fields used to synchronize a Projects-side Quotation Approval rejection.
alter table public.qt_quotations
  add column if not exists rejection_reason text,
  add column if not exists rejected_by uuid references public.platform_users(id) on delete set null,
  add column if not exists rejected_at timestamptz;

notify pgrst, 'reload schema';
