-- ═══════════════════════════════════════════════════════════════════
-- Soft Delete & Recover System for Quotes + Reply-to-Customer history
-- Additive only — no existing column/table is altered or dropped.
-- Mirrors supabase/schema-orders-soft-delete.sql exactly for Quotes.
-- ═══════════════════════════════════════════════════════════════════

alter table public.quotes add column if not exists is_deleted          boolean not null default false;
alter table public.quotes add column if not exists deleted_at          timestamptz;
alter table public.quotes add column if not exists deleted_by          uuid references public.admin_users(id) on delete set null;
alter table public.quotes add column if not exists recovered_at        timestamptz;
alter table public.quotes add column if not exists recovered_by        uuid references public.admin_users(id) on delete set null;
alter table public.quotes add column if not exists permanently_deleted boolean not null default false;
alter table public.quotes add column if not exists auto_delete_at      timestamptz;

create index if not exists idx_quotes_is_deleted     on public.quotes (is_deleted);
create index if not exists idx_quotes_deleted_at     on public.quotes (deleted_at);
create index if not exists idx_quotes_auto_delete_at on public.quotes (auto_delete_at);

-- ── Reply-to-Customer history (Feature 5-9) ──────────────────────────
-- Attachments are stored inline as a jsonb array of small base64 blobs
-- (no Supabase Storage bucket to provision) — a deliberate scoping
-- simplification for a first pass; each attachment is capped client-
-- and server-side (see api/admin/quotes/reply.js) to keep row size sane.
create table if not exists public.quote_replies (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references public.quotes(id) on delete cascade,
  admin_id     uuid references public.admin_users(id) on delete set null,
  admin_name   text,
  to_email     text not null,
  subject      text not null,
  message      text not null,
  attachments  jsonb not null default '[]'::jsonb, -- [{name, mime, size, dataBase64}]
  status       text not null default 'sent',       -- sent|failed
  error        text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_quote_replies_quote_id on public.quote_replies (quote_id);
alter table public.quote_replies enable row level security;

notify pgrst, 'reload schema';
