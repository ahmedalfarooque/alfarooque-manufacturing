-- ════════════════════════════════════════════════════════════════════
-- Quotation app — schema v3 (Phase 5+6 upgrade). Idempotent.
-- Run AFTER quotation-schema.sql and quotation-schema-v2.sql.
-- ════════════════════════════════════════════════════════════════════

-- ── Products: ERP catalogue upgrade ───────────────────────────────────
alter table qt_catalogue_products
  add column if not exists sub_category text,
  add column if not exists sku text,
  add column if not exists barcode text,
  add column if not exists dimensions jsonb not null default '{}'::jsonb,
    -- { length, width, height, thickness, depth, diameter, weight, area, volume } — all optional
  add column if not exists images jsonb not null default '[]'::jsonb,
    -- [ { path, name } ] — image_path column stays as the PRIMARY image
  add column if not exists notes text;

create index if not exists qt_catalogue_subcat_idx on qt_catalogue_products (category, sub_category);
create index if not exists qt_catalogue_sku_idx on qt_catalogue_products (sku);

-- Never-reused product IDs: sequence-backed (replaces count-based codes).
create sequence if not exists qt_product_code_seq;
select setval('qt_product_code_seq',
  greatest(
    coalesce((select max(nullif(regexp_replace(code, '\D', '', 'g'), '')::bigint)
              from qt_catalogue_products where code ~ '^P-\d+$'), 0),
    coalesce((select last_value from qt_product_code_seq), 0), 1));

create or replace function qt_next_product_code()
returns text language sql as
$$ select 'P-' || lpad(nextval('qt_product_code_seq')::text, 6, '0') $$;

-- ── Quotation products: dimensions for dynamic size pricing ───────────
alter table qt_quotation_products
  add column if not exists dimensions jsonb not null default '{}'::jsonb,
  add column if not exists base_dimensions jsonb not null default '{}'::jsonb;

-- ── Suppliers: extended profile ────────────────────────────────────────
alter table qt_suppliers
  add column if not exists country text default 'Saudi Arabia',
  add column if not exists currency char(3) default 'SAR',
  add column if not exists bank_name text,
  add column if not exists iban text,
  add column if not exists contacts jsonb not null default '[]'::jsonb;
    -- [ { name, role, phone, email } ]

-- ── Quotation-app-specific user roles (identity stays platform_users) ──
create table if not exists qt_user_roles (
  user_id uuid primary key,
  role text not null default 'readonly' check (role in
    ('admin','manager','sales','estimator','accountant','production','readonly')),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

-- ── Settings additions (idempotent seeds) ─────────────────────────────
insert into qt_settings (entity_id, key, value)
select null, 'translation', '{"auto":true}'::jsonb
where not exists (select 1 from qt_settings where key = 'translation' and entity_id is null);

insert into qt_settings (entity_id, key, value)
select null, 'numbering', '{"product_prefix":"P-","product_pad":6}'::jsonb
where not exists (select 1 from qt_settings where key = 'numbering' and entity_id is null);
