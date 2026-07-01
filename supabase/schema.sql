-- ═══════════════════════════════════════════════════════════════════
-- AL FAROOQUE — Supabase database schema
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (idempotent: IF NOT EXISTS / CREATE OR REPLACE).
--
-- Supabase's built-in `auth.users` table already stores:
--   id, email, encrypted_password, email_confirmed_at (email verified),
--   last_sign_in_at (last login), created_at, raw_user_meta_data.
-- This schema adds the app-specific profile + commerce tables, all
-- protected by Row-Level Security so each user sees only their own data.
-- ═══════════════════════════════════════════════════════════════════

-- ── Roles (admin-ready) ──────────────────────────────────────────────
do $$ begin
  create type public.user_role as enum ('admin', 'manager', 'customer');
exception when duplicate_object then null; end $$;

-- ── PROFILES (1:1 with auth.users) ───────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  first_name  text,
  last_name   text,
  full_name   text,
  mobile      text,
  avatar_url  text,
  address     text,
  city        text,
  country     text,
  role        public.user_role not null default 'customer',
  status      text not null default 'active',          -- active | suspended | banned
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── WISHLIST / SAVED PRODUCTS ────────────────────────────────────────
create table if not exists public.wishlist (
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ── ADDRESSES ────────────────────────────────────────────────────────
create table if not exists public.addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  label      text,
  line1      text,
  city       text,
  country    text,
  phone      text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── SAVED CART (guest cart merges here on login) ─────────────────────
create table if not exists public.carts (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  items      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- ── ORDERS (placeholder for future order history) ────────────────────
create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  order_no    text unique,
  status      text not null default 'pending',         -- pending|confirmed|shipped|delivered|cancelled
  items       jsonb not null default '[]'::jsonb,
  subtotal    numeric(12,2) default 0,
  vat         numeric(12,2) default 0,
  grand_total numeric(12,2) default 0,
  created_at  timestamptz not null default now()
);

-- ── updated_at auto-touch ────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── Auto-create a profile row when a user signs up ───────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, full_name, mobile)
  values (
    new.id,
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    coalesce(new.raw_user_meta_data->>'full_name',
             trim(concat(new.raw_user_meta_data->>'first_name', ' ', new.raw_user_meta_data->>'last_name'))),
    new.raw_user_meta_data->>'mobile'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY — every user can touch only their own rows
-- ═══════════════════════════════════════════════════════════════════
alter table public.profiles  enable row level security;
alter table public.wishlist  enable row level security;
alter table public.addresses enable row level security;
alter table public.carts     enable row level security;
alter table public.orders    enable row level security;

-- profiles
drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "own profile write"  on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
create policy "own profile read"   on public.profiles for select using (auth.uid() = id);
create policy "own profile write"  on public.profiles for update using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);

-- generic per-user policy helper applied to the rest
do $$
declare tbl text;
begin
  foreach tbl in array array['wishlist','addresses','carts','orders'] loop
    execute format('drop policy if exists "own rows" on public.%I;', tbl);
    execute format(
      'create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      tbl);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════
-- AVATAR STORAGE (run once) — public bucket "avatars"
-- ═══════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar read"   on storage.objects;
drop policy if exists "avatar write"  on storage.objects;
create policy "avatar read"  on storage.objects for select using (bucket_id = 'avatars');
create policy "avatar write" on storage.objects for insert with check (bucket_id = 'avatars' and auth.uid() = owner);

-- ── To promote a user to admin later (admin panel groundwork):
--    update public.profiles set role = 'admin' where id = '<user-uuid>';
-- ═══════════════════════════════════════════════════════════════════
