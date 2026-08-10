-- One authoritative approval flag on the existing shared identity.
-- Existing active accounts pre-date this workflow and are treated as already
-- approved; every account created after this migration defaults unapproved.
alter table public.platform_users add column if not exists is_approved boolean;
update public.platform_users set is_approved = true where is_approved is null;
alter table public.platform_users alter column is_approved set default false;
alter table public.platform_users alter column is_approved set not null;

-- Extend the existing per-user/per-app access grant instead of creating a
-- second permission table. App access alone never implies delete permission.
alter table public.app_permissions
  add column if not exists can_delete boolean not null default false;

create index if not exists idx_app_permissions_delete
  on public.app_permissions (user_id, app_id)
  where can_delete = true;

comment on column public.platform_users.is_approved is
  'Authoritative admin approval state. New non-admin accounts are unapproved by default.';
comment on column public.app_permissions.can_delete is
  'Explicit app-scoped delete grant; effective only while the user is active and admin-approved.';

notify pgrst, 'reload schema';
