-- ═══════════════════════════════════════════════════════════════════
-- Soft Delete & Recover System for Orders
-- Additive only — no existing column/table is altered or dropped.
-- Run this once against the shared Supabase project (same convention
-- as every other supabase/schema*.sql file in this repo).
-- ═══════════════════════════════════════════════════════════════════

alter table public.orders add column if not exists is_deleted          boolean not null default false;
alter table public.orders add column if not exists deleted_at          timestamptz;
alter table public.orders add column if not exists deleted_by          uuid references public.admin_users(id) on delete set null;
alter table public.orders add column if not exists recovered_at        timestamptz;
alter table public.orders add column if not exists recovered_by        uuid references public.admin_users(id) on delete set null;
alter table public.orders add column if not exists permanently_deleted boolean not null default false;
/* Stored explicitly (rather than recomputed as deleted_at + 30 days on
   every read) so the auto-purge cron is a single indexed WHERE clause
   and every "Days Remaining" read is just a subtraction, not a
   recomputation — set on delete, cleared on recover. */
alter table public.orders add column if not exists auto_delete_at      timestamptz;

create index if not exists idx_orders_is_deleted    on public.orders (is_deleted);
create index if not exists idx_orders_deleted_at    on public.orders (deleted_at);
create index if not exists idx_orders_auto_delete_at on public.orders (auto_delete_at);
create index if not exists idx_orders_order_no      on public.orders (order_no);
create index if not exists idx_orders_user_id       on public.orders (user_id);

-- Reload PostgREST's schema cache immediately — without this, the API
-- layer can keep returning "column does not exist" for a short window
-- after the migration runs even though the column now exists.
notify pgrst, 'reload schema';
