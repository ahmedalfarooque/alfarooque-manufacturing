-- =============================================================================
-- AL FAROOQUE ERP — Sales Order Tracking (Quotation → Cash pipeline)
-- Version: inv-schema-v08-sales-orders
-- Run AFTER inv-schema-v07-app-permissions.sql
--
-- Ties together pieces that already exist independently:
--   Quotation (qt_quotations)  →  reserve stock (inv_stock_reservations)
--   →  deliver (fulfills the reservation, an Inventory Goods Issue)
--   →  invoice (acc_invoices)  →  payment (acc_payments)
-- as one auditable chain, instead of leaving the connection implicit.
-- Lives in the Projects app (apps/projects), which already converts
-- Quotations into pm_projects and is the natural home for cross-app
-- fulfillment tracking.
-- =============================================================================

create table if not exists sales_orders (
  id            uuid primary key default gen_random_uuid(),
  so_number     text unique,
  quotation_id  uuid references qt_quotations(id),
  project_id    uuid references pm_projects(id),
  customer_name text not null,
  status        text not null default 'Draft' check (status in
                  ('Draft','Reserved','Delivered','Invoiced','Paid','Cancelled')),
  currency      text not null default 'SAR',
  total_amount  numeric(16,4) not null default 0,
  invoice_id    uuid references acc_invoices(id),
  notes         text,
  created_by    uuid references platform_users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_sales_orders_status     on sales_orders(status);
create index if not exists idx_sales_orders_quotation  on sales_orders(quotation_id);
create index if not exists idx_sales_orders_project    on sales_orders(project_id);

create table if not exists sales_order_lines (
  id              uuid primary key default gen_random_uuid(),
  sales_order_id  uuid not null references sales_orders(id) on delete cascade,
  description     text not null,
  inv_product_id  uuid references inv_products(id),
  inv_material_id uuid references inv_materials(id),
  qty             numeric(14,4) not null default 1,
  unit_price      numeric(14,4) not null default 0,
  warehouse_id    uuid references inv_warehouses(id),
  reservation_id  uuid references inv_stock_reservations(id),
  created_at      timestamptz not null default now()
);

create index if not exists idx_sol_order on sales_order_lines(sales_order_id);

-- Row Level Security intentionally disabled — service-role key used
-- server-side only, same pattern as every other table in this project.
