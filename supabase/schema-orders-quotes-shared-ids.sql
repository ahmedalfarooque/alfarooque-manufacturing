-- ═══════════════════════════════════════════════════════════════════
-- Allow Orders/Quotes soft-delete audit columns to reference EITHER
-- app's user table (public.admin_users for the Website Admin, or
-- public.platform_users for the Projects app / ProTrack) — both apps
-- now write to the same public.orders / public.quotes tables, but
-- deleted_by/recovered_by were originally FK-locked to admin_users
-- only, which would reject a write from a Projects-app user (a
-- platform_users.id) with a foreign-key violation.
--
-- Dropping the FK (keeping the plain uuid column) is the simplest fix:
-- the column is a display/audit field, not a relational join target
-- elsewhere, so losing referential-integrity enforcement here is a
-- reasonable tradeoff for two independent identity tables sharing one
-- soft-delete column. Application code resolves the display name by
-- checking admin_users first, then platform_users.
-- ═══════════════════════════════════════════════════════════════════

alter table public.orders drop constraint if exists orders_deleted_by_fkey;
alter table public.orders drop constraint if exists orders_recovered_by_fkey;
alter table public.quotes drop constraint if exists quotes_deleted_by_fkey;
alter table public.quotes drop constraint if exists quotes_recovered_by_fkey;

notify pgrst, 'reload schema';
