-- =============================================================================
-- AL FAROOQUE INVENTORY ERP — Phase 1 Schema
-- Version: inv-schema-v01-initial
-- All tables use prefix: inv_
-- Run in Supabase SQL Editor (service role required for RLS bypass)
-- =============================================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- inv_categories  (product & material categories)
-- ---------------------------------------------------------------------------
create table if not exists inv_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  name_ar     text,
  description text,
  color       text,
  is_active   boolean not null default true,
  created_by  uuid references platform_users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_subcategories
-- ---------------------------------------------------------------------------
create table if not exists inv_subcategories (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references inv_categories(id) on delete cascade,
  name        text not null,
  name_ar     text,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_units  (units of measure: kg, pcs, m², litre, …)
-- ---------------------------------------------------------------------------
create table if not exists inv_units (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  symbol     text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_brands
-- ---------------------------------------------------------------------------
create table if not exists inv_brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_suppliers
-- ---------------------------------------------------------------------------
create table if not exists inv_suppliers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  name_ar        text,
  contact_person text,
  email          text,
  phone          text,
  address        text,
  city           text,
  country        text default 'Saudi Arabia',
  vat_number     text,
  cr_number      text,
  payment_terms  text,
  notes          text,
  is_active      boolean not null default true,
  created_by     uuid references platform_users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_warehouses
-- ---------------------------------------------------------------------------
create table if not exists inv_warehouses (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  name_ar    text,
  code       text unique,
  address    text,
  city       text,
  manager_id uuid references platform_users(id),
  notes      text,
  is_active  boolean not null default true,
  created_by uuid references platform_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_locations  (bins/shelves/zones inside warehouses)
-- ---------------------------------------------------------------------------
create table if not exists inv_locations (
  id           uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references inv_warehouses(id) on delete cascade,
  name         text not null,
  code         text,
  location_type text check (location_type in ('zone','rack','shelf','bin','floor')) default 'bin',
  notes        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_products  (finished goods / saleable items)
-- ---------------------------------------------------------------------------
create table if not exists inv_products (
  id              uuid primary key default gen_random_uuid(),
  sku             text unique,
  barcode         text,
  name            text not null,
  name_ar         text,
  description     text,
  category_id     uuid references inv_categories(id),
  subcategory_id  uuid references inv_subcategories(id),
  unit_id         uuid references inv_units(id),
  brand_id        uuid references inv_brands(id),
  cost_price      numeric(14,4) not null default 0,
  selling_price   numeric(14,4) not null default 0,
  min_stock_qty   numeric(14,4) not null default 0,
  max_stock_qty   numeric(14,4),
  reorder_point   numeric(14,4),
  weight_kg       numeric(10,4),
  image_url       text,
  notes           text,
  is_active       boolean not null default true,
  -- denormalized running totals (updated by triggers / API)
  qty_on_hand     numeric(14,4) not null default 0,
  created_by      uuid references platform_users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_materials  (raw materials / consumables)
-- ---------------------------------------------------------------------------
create table if not exists inv_materials (
  id              uuid primary key default gen_random_uuid(),
  material_code   text unique,
  name            text not null,
  name_ar         text,
  description     text,
  category_id     uuid references inv_categories(id),
  unit_id         uuid references inv_units(id),
  supplier_id     uuid references inv_suppliers(id),
  cost_price      numeric(14,4) not null default 0,
  min_stock_qty   numeric(14,4) not null default 0,
  max_stock_qty   numeric(14,4),
  reorder_point   numeric(14,4),
  notes           text,
  is_active       boolean not null default true,
  qty_on_hand     numeric(14,4) not null default 0,
  created_by      uuid references platform_users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_stock  (per-warehouse stock ledger)
-- ---------------------------------------------------------------------------
create table if not exists inv_stock (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid references inv_products(id) on delete cascade,
  material_id  uuid references inv_materials(id) on delete cascade,
  warehouse_id uuid not null references inv_warehouses(id) on delete restrict,
  location_id  uuid references inv_locations(id),
  qty_on_hand  numeric(14,4) not null default 0,
  qty_reserved numeric(14,4) not null default 0,
  avg_cost     numeric(14,4) not null default 0,
  last_cost    numeric(14,4),
  updated_at   timestamptz not null default now(),
  constraint inv_stock_one_item check (
    (product_id is not null and material_id is null) or
    (product_id is null and material_id is not null)
  ),
  unique (product_id, warehouse_id),
  unique (material_id, warehouse_id)
);

-- ---------------------------------------------------------------------------
-- inv_stock_movements  (immutable audit trail of every stock change)
-- ---------------------------------------------------------------------------
create table if not exists inv_stock_movements (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid references inv_products(id),
  material_id   uuid references inv_materials(id),
  warehouse_id  uuid references inv_warehouses(id),
  location_id   uuid references inv_locations(id),
  movement_type text not null check (movement_type in (
    'receipt','issue','transfer_in','transfer_out',
    'adjustment_in','adjustment_out','return_in','return_out'
  )),
  qty           numeric(14,4) not null,
  unit_cost     numeric(14,4),
  reference     text,           -- e.g. GR number, PO number, transfer ref
  notes         text,
  created_by    uuid references platform_users(id),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_purchase_requests
-- ---------------------------------------------------------------------------
create table if not exists inv_purchase_requests (
  id           uuid primary key default gen_random_uuid(),
  pr_number    text unique,
  title        text not null,
  priority     text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  status       text not null default 'pending' check (status in ('pending','approved','rejected','ordered')),
  needed_by    date,
  notes        text,
  rejection_notes text,
  requested_by uuid references platform_users(id),
  approved_by  uuid references platform_users(id),
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_purchase_request_items
-- ---------------------------------------------------------------------------
create table if not exists inv_purchase_request_items (
  id          uuid primary key default gen_random_uuid(),
  pr_id       uuid not null references inv_purchase_requests(id) on delete cascade,
  product_id  uuid references inv_products(id),
  material_id uuid references inv_materials(id),
  qty_requested numeric(14,4) not null default 1,
  unit_cost   numeric(14,4),
  notes       text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_purchase_orders
-- ---------------------------------------------------------------------------
create table if not exists inv_purchase_orders (
  id                uuid primary key default gen_random_uuid(),
  po_number         text unique,
  supplier_id       uuid references inv_suppliers(id),
  pr_id             uuid references inv_purchase_requests(id),
  status            text not null default 'pending' check (status in ('pending','ordered','partial','received','cancelled')),
  currency          text not null default 'SAR',
  total_amount      numeric(14,2) not null default 0,
  expected_delivery date,
  notes             text,
  created_by        uuid references platform_users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_purchase_order_items
-- ---------------------------------------------------------------------------
create table if not exists inv_purchase_order_items (
  id           uuid primary key default gen_random_uuid(),
  po_id        uuid not null references inv_purchase_orders(id) on delete cascade,
  product_id   uuid references inv_products(id),
  material_id  uuid references inv_materials(id),
  description  text,
  qty_ordered  numeric(14,4) not null default 1,
  qty_received numeric(14,4) not null default 0,
  unit_cost    numeric(14,4) not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_goods_receipts
-- ---------------------------------------------------------------------------
create table if not exists inv_goods_receipts (
  id             uuid primary key default gen_random_uuid(),
  gr_number      text unique,
  supplier_id    uuid references inv_suppliers(id),
  warehouse_id   uuid not null references inv_warehouses(id),
  po_id          uuid references inv_purchase_orders(id),
  receipt_date   date not null default current_date,
  invoice_number text,
  delivery_note  text,
  notes          text,
  received_by    uuid references platform_users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_goods_receipt_items
-- ---------------------------------------------------------------------------
create table if not exists inv_goods_receipt_items (
  id           uuid primary key default gen_random_uuid(),
  gr_id        uuid not null references inv_goods_receipts(id) on delete cascade,
  product_id   uuid references inv_products(id),
  material_id  uuid references inv_materials(id),
  qty_received numeric(14,4) not null default 0,
  unit_cost    numeric(14,4) not null default 0,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- inv_user_roles  (per-user inventory access level)
-- ---------------------------------------------------------------------------
create table if not exists inv_user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references platform_users(id) on delete cascade,
  role       text not null check (role in ('admin','manager','warehouse','purchasing','readonly')),
  granted_by uuid references platform_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- Indexes for common query patterns
-- =============================================================================

create index if not exists idx_inv_products_sku         on inv_products(sku);
create index if not exists idx_inv_products_name        on inv_products(name);
create index if not exists idx_inv_products_category    on inv_products(category_id);
create index if not exists idx_inv_products_is_active   on inv_products(is_active);

create index if not exists idx_inv_materials_code       on inv_materials(material_code);
create index if not exists idx_inv_materials_name       on inv_materials(name);
create index if not exists idx_inv_materials_is_active  on inv_materials(is_active);

create index if not exists idx_inv_stock_product        on inv_stock(product_id);
create index if not exists idx_inv_stock_material       on inv_stock(material_id);
create index if not exists idx_inv_stock_warehouse      on inv_stock(warehouse_id);

create index if not exists idx_inv_movements_product    on inv_stock_movements(product_id);
create index if not exists idx_inv_movements_material   on inv_stock_movements(material_id);
create index if not exists idx_inv_movements_warehouse  on inv_stock_movements(warehouse_id);
create index if not exists idx_inv_movements_type       on inv_stock_movements(movement_type);
create index if not exists idx_inv_movements_created    on inv_stock_movements(created_at desc);

create index if not exists idx_inv_pr_status            on inv_purchase_requests(status);
create index if not exists idx_inv_pr_created           on inv_purchase_requests(created_at desc);

create index if not exists idx_inv_po_status            on inv_purchase_orders(status);
create index if not exists idx_inv_po_supplier          on inv_purchase_orders(supplier_id);
create index if not exists idx_inv_po_created           on inv_purchase_orders(created_at desc);

create index if not exists idx_inv_gr_supplier          on inv_goods_receipts(supplier_id);
create index if not exists idx_inv_gr_warehouse         on inv_goods_receipts(warehouse_id);
create index if not exists idx_inv_gr_created           on inv_goods_receipts(created_at desc);

create index if not exists idx_inv_suppliers_name       on inv_suppliers(name);
create index if not exists idx_inv_suppliers_active     on inv_suppliers(is_active);

create index if not exists idx_inv_locations_warehouse  on inv_locations(warehouse_id);

-- =============================================================================
-- Row Level Security — disabled (service-role key used server-side only)
-- =============================================================================
-- RLS is intentionally not enabled on inv_* tables.
-- All access is via Next.js API routes that authenticate the session cookie
-- and use the Supabase service-role key (never exposed to the browser).
-- The permission layer in apps/inventory/lib/perms.js handles authorization.

-- =============================================================================
-- Seed data — optional defaults
-- =============================================================================

-- Default units
insert into inv_units (name, symbol) values
  ('Piece', 'pcs'),
  ('Kilogram', 'kg'),
  ('Gram', 'g'),
  ('Tonne', 't'),
  ('Metre', 'm'),
  ('Centimetre', 'cm'),
  ('Square Metre', 'm²'),
  ('Cubic Metre', 'm³'),
  ('Litre', 'L'),
  ('Box', 'box'),
  ('Pallet', 'plt'),
  ('Roll', 'roll'),
  ('Sheet', 'sheet'),
  ('Set', 'set')
on conflict do nothing;

-- Default categories
insert into inv_categories (name, name_ar) values
  ('Wood Products', 'منتجات خشبية'),
  ('Steel Products', 'منتجات فولاذية'),
  ('Aluminium Products', 'منتجات ألومنيوم'),
  ('Raw Materials', 'مواد خام'),
  ('Spare Parts', 'قطع الغيار'),
  ('Consumables', 'مستهلكات'),
  ('Packaging', 'تعبئة وتغليف'),
  ('Safety Equipment', 'معدات السلامة')
on conflict do nothing;
