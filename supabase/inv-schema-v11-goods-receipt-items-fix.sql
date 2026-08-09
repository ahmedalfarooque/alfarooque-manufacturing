-- =============================================================================
-- AL FAROOQUE ERP — Goods Receipt Items column fix
-- Version: inv-schema-v11-goods-receipt-items-fix
-- Run AFTER inv-schema-v10-crm-schema-fix.sql
--
-- apps/inventory/app/api/goods-receipts/route.js inserts `location_id` and
-- `po_item_id` into inv_goods_receipt_items — neither column existed on
-- the table as defined in inv-schema-v01-initial.sql. Found by the
-- production-readiness audit: providing an unknown key in a Supabase
-- insert payload fails with "column does not exist" regardless of its
-- value, so EVERY Goods Receipt (not only PO-linked ones) would fail to
-- record its line items. Both columns are meaningful (which storage
-- location the item was put away in; which PO line it fulfills), so this
-- adds them rather than removing the fields from the code.
-- =============================================================================

alter table inv_goods_receipt_items
  add column if not exists location_id uuid references inv_locations(id),
  add column if not exists po_item_id  uuid references inv_purchase_order_items(id);

create index if not exists idx_gri_po_item on inv_goods_receipt_items(po_item_id);
