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

-- Extended profile fields (idempotent — adds columns if the table already exists)
alter table public.profiles add column if not exists company     text;
alter table public.profiles add column if not exists gender      text;
alter table public.profiles add column if not exists birthdate   date;
alter table public.profiles add column if not exists postal_code text;

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

-- Extended fields for the map-based address picker (idempotent)
alter table public.addresses add column if not exists state       text;
alter table public.addresses add column if not exists postal_code text;
alter table public.addresses add column if not exists lat         double precision;
alter table public.addresses add column if not exists lng         double precision;

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


-- ═══════════════════════════════════════════════════════════════════
-- ADMIN SYSTEM — completely separate from customer auth (public.profiles /
-- auth.users). Admin accounts, sessions and OTPs live in their own tables
-- and are NEVER reachable through the anon/publishable key — every admin
-- API route (/api/admin/*) uses the SUPABASE_SERVICE_ROLE_KEY server-side
-- and enforces its own session cookie. RLS below denies the anon/authenticated
-- roles entirely (no policies = no access) as defense in depth.
-- ═══════════════════════════════════════════════════════════════════
create extension if not exists pgcrypto;

-- ── Admin accounts ────────────────────────────────────────────────────
create table if not exists public.admin_users (
  id                    uuid primary key default gen_random_uuid(),
  email                 text unique not null,
  password_hash         text not null,           -- bcrypt (never plain text)
  full_name             text,
  role                  text not null default 'admin', -- admin|manager|sales|production|support|viewer
  is_active             boolean not null default true,
  must_change_password  boolean not null default true,
  created_at            timestamptz not null default now(),
  last_login_at         timestamptz
);

-- ── One-time login codes (6-digit, hashed, 5-minute expiry, single-use) ──
create table if not exists public.admin_otp_codes (
  id            uuid primary key default gen_random_uuid(),
  admin_id      uuid not null references public.admin_users(id) on delete cascade,
  code_hash     text not null,                    -- sha256(code), never plain text
  purpose       text not null default 'login',
  attempt_count int not null default 0,
  expires_at    timestamptz not null,
  consumed_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_admin_otp_admin on public.admin_otp_codes(admin_id, created_at desc);

-- ── Sessions (opaque random token, hashed; supports "logout everywhere") ──
create table if not exists public.admin_sessions (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references public.admin_users(id) on delete cascade,
  token_hash  text not null unique,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz
);
create index if not exists idx_admin_sessions_admin on public.admin_sessions(admin_id);

-- ── Login attempts (server-side rate limiting) ───────────────────────
create table if not exists public.admin_login_attempts (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  ip         text,
  success    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_login_attempts_email on public.admin_login_attempts(email, created_at desc);

-- ── Audit log (who did what, when, from where) ───────────────────────
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.admin_users(id) on delete set null,
  admin_email text,
  action      text not null,                      -- e.g. "order.status_update", "product.create"
  entity_type text,
  entity_id   text,
  details     jsonb,
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

-- ── Admin notifications (orders, payments, customers, low stock, quotes) ──
create table if not exists public.admin_notifications (
  id         uuid primary key default gen_random_uuid(),
  type       text not null,                        -- order|payment|customer|low_stock|quote|system
  title      text not null,
  body       text,
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_admin_notifications_created on public.admin_notifications(created_at desc);

-- ── Categories (nested, sortable) ─────────────────────────────────────
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  name_ar     text,
  parent_id   uuid references public.categories(id) on delete set null,
  icon        text,
  image_url   text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Products (migrated from the static js/products.js catalog) ───────
-- Numeric id preserved to stay compatible with existing cart/wishlist/order
-- item references (product_id) used across the customer-facing site.
create table if not exists public.products (
  id                bigint primary key,
  category_slug     text references public.categories(slug) on delete set null,
  name              text not null,
  name_ar           text,
  description       text,
  description_ar    text,
  price             numeric(12,2) not null default 0,
  compare_at_price  numeric(12,2),
  stock             int not null default 0,
  low_stock_threshold int not null default 5,
  sku               text,
  material          text,
  availability      text default 'In Stock',
  rating            numeric(3,2) default 0,
  review_count      int default 0,
  badge             text,
  is_featured       boolean not null default false,
  is_active         boolean not null default true,
  tags              jsonb default '[]'::jsonb,
  images            jsonb default '[]'::jsonb,
  videos            jsonb default '[]'::jsonb,
  features          jsonb default '[]'::jsonb,
  features_ar       jsonb default '[]'::jsonb,
  specs             jsonb default '{}'::jsonb,
  specs_ar          jsonb default '{}'::jsonb,
  applications      jsonb default '[]'::jsonb,
  applications_ar   jsonb default '[]'::jsonb,
  finishes          jsonb default '[]'::jsonb,
  finishes_ar       jsonb default '[]'::jsonb,
  sizes             jsonb default '[]'::jsonb,
  sizes_ar          jsonb default '[]'::jsonb,
  warranty_label    text,
  warranty_label_ar text,
  seo_title         text,
  seo_description   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_products_category on public.products(category_slug);

drop trigger if exists trg_categories_touch on public.categories;
create trigger trg_categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();
drop trigger if exists trg_products_touch on public.products;
create trigger trg_products_touch before update on public.products
  for each row execute function public.touch_updated_at();

-- ── Orders: support guest checkout (no account) + admin tracking fields ──
alter table public.orders alter column user_id drop not null;
alter table public.orders add column if not exists guest_name           text;
alter table public.orders add column if not exists guest_email          text;
alter table public.orders add column if not exists guest_phone          text;
alter table public.orders add column if not exists source               text default 'account'; -- account|guest
alter table public.orders add column if not exists payment_status       text default 'pending';  -- pending|paid|failed|refunded
alter table public.orders add column if not exists current_stage        text;
alter table public.orders add column if not exists estimated_completion date;
alter table public.orders add column if not exists estimated_delivery   date;
alter table public.orders add column if not exists tracking_pct         int default 0;
alter table public.orders add column if not exists admin_notes          text;
alter table public.orders add column if not exists timeline             jsonb default '[]'::jsonb; -- [{status, at, note}]

-- ── Quotes (Request-a-Quote / contact submissions, admin-manageable) ──
create table if not exists public.quotes (
  id           uuid primary key default gen_random_uuid(),
  name         text,
  email        text,
  phone        text,
  message      text,
  product      text,
  status       text not null default 'new',        -- new|contacted|quoted|converted|closed
  order_id     uuid references public.orders(id) on delete set null,
  admin_notes  text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_quotes_created on public.quotes(created_at desc);

-- ═══════════════════════════════════════════════════════════════════
-- RLS — admin tables are locked down entirely (no policies = deny all
-- for anon/authenticated). Only the service-role key (server-side admin
-- API routes) can read/write them, since service role bypasses RLS.
-- ═══════════════════════════════════════════════════════════════════
alter table public.admin_users         enable row level security;
alter table public.admin_otp_codes     enable row level security;
alter table public.admin_sessions      enable row level security;
alter table public.admin_login_attempts enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.quotes              enable row level security;

-- Categories/products: public can read the live catalog, only the
-- service role (admin API) can write.
alter table public.categories enable row level security;
alter table public.products   enable row level security;
drop policy if exists "public read categories" on public.categories;
drop policy if exists "public read products"   on public.products;
create policy "public read categories" on public.categories for select using (is_active = true);
create policy "public read products"   on public.products   for select using (is_active = true);

-- ── Seed the initial admin account (change the password after first login —
--    must_change_password is already set to true). Safe to re-run. ──
insert into public.admin_users (email, password_hash, full_name, role, must_change_password)
values (
  'arshad@alfarooque.com',
  crypt('123Abc45@@', gen_salt('bf', 12)),
  'Arshad',
  'admin',
  true
)
on conflict (email) do nothing;
-- ═══════════════════════════════════════════════════════════════════
