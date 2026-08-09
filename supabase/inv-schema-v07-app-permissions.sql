-- =============================================================================
-- AL FAROOQUE ERP — Shared App Permissions
-- Version: inv-schema-v07-app-permissions
-- Run AFTER inv-schema-v06-crm-cross-links.sql
--
-- Gates WHICH apps a user may access, on top of the existing per-app
-- *_user_roles tables (which grant a ROLE within an app assuming the user
-- already has access). Presence of a row = access granted. Empty for a
-- user = no access — this is safe to introduce because every app's
-- AppSwitcherButtons component previously hid itself entirely for any
-- non-admin user, so non-admins already saw zero cross-app options; this
-- table only gives admins a real lever to grant them, it doesn't take
-- anything away that existed before.
--
-- Super admin (arshad@alfarooque.com) and any platform 'admin' always see
-- every app regardless of this table — enforced in application code
-- (lib/superAdmin.js + the app-permissions route), not here.
-- =============================================================================

create table if not exists app_permissions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references platform_users(id) on delete cascade,
  app_id     text not null check (app_id in ('quotation','projects','cars','inventory','accounting','crm')),
  granted_by uuid references platform_users(id),
  created_at timestamptz not null default now(),
  unique (user_id, app_id)
);

create index if not exists idx_app_permissions_user on app_permissions(user_id);
