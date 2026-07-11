-- ════════════════════════════════════════════════════════════════════
-- ONE-TIME cleanup of demo/testing records (structure & seeds kept).
-- Review each section before running — comment out any block you want
-- to keep. Does NOT drop tables. Safe to re-run.
-- ════════════════════════════════════════════════════════════════════

begin;

-- 1. Quotations (products, cost lines, events, approvals cascade)
delete from qt_quotations;

-- 2. Catalogue products (+ cost lines & price history cascade)
delete from qt_catalogue_products;

-- 3. Materials & hardware (+ price history & supplier links cascade)
delete from qt_material_suppliers;
delete from qt_material_price_history;
delete from qt_materials;

-- 4. Customers (+ contacts cascade)
delete from qt_customer_contacts;
delete from qt_customers;

-- 5. Suppliers
delete from qt_suppliers;

-- 6. UX residue from testing
delete from qt_favorites;
delete from qt_recent_items;
delete from qt_notifications;
delete from qt_attachments;
delete from qt_import_jobs;
-- Audit log kept for traceability. Uncomment to clear:
-- delete from qt_audit_logs;

-- 7. Reset numbering so production starts clean
update qt_entities set next_seq = 1;
select setval('qt_product_code_seq', 1, false);

commit;

-- KEPT (production structure & seeds): qt_entities, qt_settings,
-- qt_terms_templates, qt_material_categories, qt_labour_roles,
-- qt_machines, qt_expense_templates, qt_user_roles.
