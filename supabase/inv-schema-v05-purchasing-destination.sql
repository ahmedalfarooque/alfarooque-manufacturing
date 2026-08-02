-- =============================================================================
-- AL FAROOQUE ERP — Purchasing Destination Logic
-- Version: inv-schema-v05-purchasing-destination
-- Run AFTER inv-schema-v04-accounting-schema-fix.sql
--
-- Adds a purchase "destination" to acc_bills: every vendor bill now
-- resolves to exactly one of:
--   warehouse  -> increases Inventory stock (via acc_bill_lines' inv_product_id/
--                 inv_material_id + qty, written directly to inv_stock /
--                 inv_stock_movements when the bill is created)
--   project    -> cost assigned directly to the project, no inventory change
--                 (acc_bills.project_id already existed and is reused)
--   asset      -> registers a new acc_assets fixed-asset row from the bill
-- =============================================================================

alter table acc_bills
  add column if not exists destination_type text check (destination_type in ('warehouse','project','asset')),
  add column if not exists destination_warehouse_id uuid references inv_warehouses(id),
  add column if not exists asset_category text;

create index if not exists idx_acc_bill_destination on acc_bills(destination_type);
