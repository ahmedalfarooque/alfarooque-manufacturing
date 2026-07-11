-- ════════════════════════════════════════════════════════════════════
-- Quotation app — v6: STORED BILINGUAL MODEL + performance indexes.
-- Adds *_en / *_ar columns alongside the canonical single column (kept
-- for compatibility & fallback). Display picks the column for the UI
-- language instantly — no runtime translation. Idempotent.
-- Backfill of existing rows: apps/quotation/scripts/backfill-bilingual.js
-- (restores originals from qt_lang_backup, dictionary-translates the rest).
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pg_trgm;

-- ═══ Bilingual columns ════════════════════════════════════════════════
alter table qt_catalogue_products
  add column if not exists name_en text,
  add column if not exists name_ar text,
  add column if not exists description_en text,
  add column if not exists description_ar text,
  add column if not exists sub_category_en text,
  add column if not exists sub_category_ar text;

alter table qt_quotation_products
  add column if not exists name_en text,
  add column if not exists name_ar text,
  add column if not exists description_en text,
  add column if not exists description_ar text;

alter table qt_materials
  add column if not exists name_en text,
  add column if not exists name_ar text;

alter table qt_suppliers
  add column if not exists name_en text,
  add column if not exists name_ar text;

alter table qt_customers
  add column if not exists company_name_en text,
  add column if not exists company_name_ar text,
  add column if not exists contact_person_en text,
  add column if not exists contact_person_ar text;

alter table qt_machines
  add column if not exists name_en text,
  add column if not exists name_ar text;

alter table qt_labour_roles
  add column if not exists name_en text,
  add column if not exists name_ar text;

alter table qt_expense_templates
  add column if not exists name_en text,
  add column if not exists name_ar text;

-- ═══ Search performance: trigram indexes on all searched text ═════════
create index if not exists qt_cat_name_trgm     on qt_catalogue_products using gin (name gin_trgm_ops);
create index if not exists qt_cat_name_en_trgm  on qt_catalogue_products using gin (name_en gin_trgm_ops);
create index if not exists qt_cat_name_ar_trgm  on qt_catalogue_products using gin (name_ar gin_trgm_ops);
create index if not exists qt_mat_name_trgm     on qt_materials using gin (name gin_trgm_ops);
create index if not exists qt_mat_name_en_trgm  on qt_materials using gin (name_en gin_trgm_ops);
create index if not exists qt_mat_name_ar_trgm  on qt_materials using gin (name_ar gin_trgm_ops);
create index if not exists qt_cus_name_trgm     on qt_customers using gin (company_name gin_trgm_ops);
create index if not exists qt_cus_name_en_trgm  on qt_customers using gin (company_name_en gin_trgm_ops);
create index if not exists qt_cus_name_ar_trgm  on qt_customers using gin (company_name_ar gin_trgm_ops);
create index if not exists qt_sup_name_trgm     on qt_suppliers using gin (name gin_trgm_ops);
create index if not exists qt_sup_name_en_trgm  on qt_suppliers using gin (name_en gin_trgm_ops);
create index if not exists qt_sup_name_ar_trgm  on qt_suppliers using gin (name_ar gin_trgm_ops);

-- ═══ Filter / sort performance ════════════════════════════════════════
create index if not exists qt_cat_status_cat_idx   on qt_catalogue_products (status, category, updated_at desc) where deleted_at is null;
create index if not exists qt_cat_updated_idx      on qt_catalogue_products (updated_at desc) where deleted_at is null;
create index if not exists qt_mat_kind_idx         on qt_materials (kind, category_id) where deleted_at is null;
create index if not exists qt_mat_created_idx      on qt_materials (created_at desc) where deleted_at is null;
create index if not exists qt_cus_created_idx      on qt_customers (created_at desc) where deleted_at is null;
create index if not exists qt_sup_created_idx      on qt_suppliers (created_at desc) where deleted_at is null;
create index if not exists qt_quo_entity_status_idx on qt_quotations (entity_id, status, created_at desc) where deleted_at is null;
create index if not exists qt_quo_created_idx      on qt_quotations (created_at desc) where deleted_at is null;
create index if not exists qt_qp_quotation_idx     on qt_quotation_products (quotation_id);
create index if not exists qt_mph_material_idx     on qt_material_price_history (material_id, created_at desc);
create index if not exists qt_audit_created_idx    on qt_audit_logs (created_at desc);

-- ═══ Reload PostgREST schema cache ════════════════════════════════════
notify pgrst, 'reload schema';
