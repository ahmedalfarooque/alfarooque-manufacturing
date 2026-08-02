-- =============================================================================
-- Inventory Phase 1 completion — Goods Issue, Stock Transfers, Reservations
-- Run in Supabase SQL editor after inv-schema-v01-initial.sql and
-- inv-schema-v02-cross-app.sql have already been applied.
-- Row Level Security intentionally disabled — service-role key used server-side only.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Bugfix: apps/inventory/app/api/goods-receipts/route.js has always written
-- reference_type/reference_id into inv_stock_movements, but inv-schema-v01
-- never defined those columns — every goods-receipt POST throws a Postgres
-- "column does not exist" error until this runs.
-- ---------------------------------------------------------------------------
alter table inv_stock_movements add column if not exists reference_type text;
alter table inv_stock_movements add column if not exists reference_id  uuid;
create index if not exists idx_inv_movements_reference on inv_stock_movements(reference_type, reference_id);

-- ---------------------------------------------------------------------------
-- inv_goods_issues  (stock issued out of a warehouse to a project/department/other)
-- ---------------------------------------------------------------------------
create table if not exists inv_goods_issues (
  id            uuid primary key default gen_random_uuid(),
  gi_number     text unique,
  warehouse_id  uuid not null references inv_warehouses(id) on delete restrict,
  issue_date    date not null default current_date,
  issued_to     text,                 -- free-text label (person/department/project name)
  reference_type text check (reference_type in ('project','department','sales_order','other')),
  reference_id  uuid,
  notes         text,
  issued_by     uuid references platform_users(id),
  created_at    timestamptz not null default now()
);

create table if not exists inv_goods_issue_items (
  id           uuid primary key default gen_random_uuid(),
  gi_id        uuid not null references inv_goods_issues(id) on delete cascade,
  product_id   uuid references inv_products(id),
  material_id  uuid references inv_materials(id),
  qty_issued   numeric(14,4) not null,
  unit_cost    numeric(14,4),
  constraint inv_gi_item_one_ref check (
    (product_id is not null and material_id is null) or
    (product_id is null and material_id is not null)
  )
);

-- ---------------------------------------------------------------------------
-- inv_stock_transfers  (warehouse-to-warehouse movement)
-- ---------------------------------------------------------------------------
create table if not exists inv_stock_transfers (
  id                uuid primary key default gen_random_uuid(),
  transfer_number   text unique,
  from_warehouse_id uuid not null references inv_warehouses(id) on delete restrict,
  to_warehouse_id   uuid not null references inv_warehouses(id) on delete restrict,
  transfer_date     date not null default current_date,
  notes             text,
  created_by        uuid references platform_users(id),
  created_at        timestamptz not null default now(),
  constraint inv_transfer_diff_warehouse check (from_warehouse_id <> to_warehouse_id)
);

create table if not exists inv_stock_transfer_items (
  id            uuid primary key default gen_random_uuid(),
  transfer_id   uuid not null references inv_stock_transfers(id) on delete cascade,
  product_id    uuid references inv_products(id),
  material_id   uuid references inv_materials(id),
  qty           numeric(14,4) not null,
  constraint inv_transfer_item_one_ref check (
    (product_id is not null and material_id is null) or
    (product_id is null and material_id is not null)
  )
);

-- ---------------------------------------------------------------------------
-- inv_stock_reservations  (soft-hold on stock; increments inv_stock.qty_reserved)
-- ---------------------------------------------------------------------------
create table if not exists inv_stock_reservations (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid references inv_products(id),
  material_id     uuid references inv_materials(id),
  warehouse_id    uuid not null references inv_warehouses(id) on delete restrict,
  qty             numeric(14,4) not null,
  status          text not null default 'active' check (status in ('active','released','fulfilled')),
  reference_type  text check (reference_type in ('sales_order','project','other')),
  reference_id    uuid,
  reference_label text,
  notes           text,
  reserved_by     uuid references platform_users(id),
  created_at      timestamptz not null default now(),
  released_at     timestamptz,
  constraint inv_resv_one_ref check (
    (product_id is not null and material_id is null) or
    (product_id is null and material_id is not null)
  )
);

create index if not exists idx_inv_gi_warehouse       on inv_goods_issues(warehouse_id);
create index if not exists idx_inv_gi_created         on inv_goods_issues(created_at desc);
create index if not exists idx_inv_transfers_from     on inv_stock_transfers(from_warehouse_id);
create index if not exists idx_inv_transfers_to       on inv_stock_transfers(to_warehouse_id);
create index if not exists idx_inv_transfers_created  on inv_stock_transfers(created_at desc);
create index if not exists idx_inv_resv_status        on inv_stock_reservations(status);
create index if not exists idx_inv_resv_product       on inv_stock_reservations(product_id);
create index if not exists idx_inv_resv_material      on inv_stock_reservations(material_id);
create index if not exists idx_inv_resv_reference     on inv_stock_reservations(reference_type, reference_id);
