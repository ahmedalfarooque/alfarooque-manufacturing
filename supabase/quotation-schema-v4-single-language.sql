-- ════════════════════════════════════════════════════════════════════
-- Quotation app — schema v4: SINGLE-LANGUAGE DATA MODEL
-- Replaces every name_en/name_ar (and description/company/body) pair
-- with ONE canonical column; display-time translation handles EN⇄AR.
-- Run AFTER v1–v3. Idempotent. A full backup of all bilingual pairs is
-- kept in qt_lang_backup before the old columns are dropped (no data
-- loss). EXCEPTION: qt_entities keeps name_en/name_ar/address_en/ar —
-- registered legal names & addresses must print exactly as registered.
-- ════════════════════════════════════════════════════════════════════

-- ── 0. Backup every bilingual pair before dropping ────────────────────
create table if not exists qt_lang_backup (
  id bigserial primary key,
  table_name text not null,
  record_id uuid,
  field text not null,
  value_en text,
  value_ar text,
  backed_up_at timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from information_schema.columns where table_name='qt_materials' and column_name='name_en') then
    insert into qt_lang_backup (table_name, record_id, field, value_en, value_ar)
      select 'qt_materials', id, 'name', name_en, name_ar from qt_materials;
    insert into qt_lang_backup (table_name, record_id, field, value_en, value_ar)
      select 'qt_suppliers', id, 'name', name_en, name_ar from qt_suppliers;
    insert into qt_lang_backup (table_name, record_id, field, value_en, value_ar)
      select 'qt_customers', id, 'company_name', company_name_en, company_name_ar from qt_customers;
    insert into qt_lang_backup (table_name, record_id, field, value_en, value_ar)
      select 'qt_labour_roles', id, 'name', name_en, name_ar from qt_labour_roles;
    insert into qt_lang_backup (table_name, record_id, field, value_en, value_ar)
      select 'qt_machines', id, 'name', name_en, name_ar from qt_machines;
    insert into qt_lang_backup (table_name, record_id, field, value_en, value_ar)
      select 'qt_expense_templates', id, 'name', name_en, name_ar from qt_expense_templates;
    insert into qt_lang_backup (table_name, record_id, field, value_en, value_ar)
      select 'qt_catalogue_products', id, 'name', name_en, name_ar from qt_catalogue_products;
    insert into qt_lang_backup (table_name, record_id, field, value_en, value_ar)
      select 'qt_catalogue_products', id, 'description', description_en, description_ar from qt_catalogue_products;
    insert into qt_lang_backup (table_name, record_id, field, value_en, value_ar)
      select 'qt_material_categories', id, 'name', name_en, name_ar from qt_material_categories;
    insert into qt_lang_backup (table_name, record_id, field, value_en, value_ar)
      select 'qt_terms_templates', id, 'body', body_en, body_ar from qt_terms_templates;
    insert into qt_lang_backup (table_name, record_id, field, value_en, value_ar)
      select 'qt_product_cost_lines', id, 'name', name_en, name_ar from qt_product_cost_lines;
    insert into qt_lang_backup (table_name, record_id, field, value_en, value_ar)
      select 'qt_qp_cost_lines', id, 'name', name_en, name_ar from qt_qp_cost_lines;
    insert into qt_lang_backup (table_name, record_id, field, value_en, value_ar)
      select 'qt_quotation_products', id, 'name', name_en, name_ar from qt_quotation_products;
    insert into qt_lang_backup (table_name, record_id, field, value_en, value_ar)
      select 'qt_quotation_products', id, 'description', description_en, description_ar from qt_quotation_products;
  end if;
end $$;

-- ── 1. Add canonical single columns + migrate (original language wins:
--       data tables prefer the Arabic source, seeded masters prefer EN) ─
alter table qt_materials add column if not exists name text;
update qt_materials set name = coalesce(nullif(name_ar,''), name_en) where name is null;

alter table qt_suppliers add column if not exists name text;
update qt_suppliers set name = coalesce(nullif(name_ar,''), name_en) where name is null;

alter table qt_customers add column if not exists company_name text;
update qt_customers set company_name = coalesce(nullif(company_name_ar,''), company_name_en) where company_name is null;

alter table qt_labour_roles add column if not exists name text;
update qt_labour_roles set name = coalesce(nullif(name_en,''), name_ar) where name is null;

alter table qt_machines add column if not exists name text;
update qt_machines set name = coalesce(nullif(name_en,''), name_ar) where name is null;

alter table qt_expense_templates add column if not exists name text;
update qt_expense_templates set name = coalesce(nullif(name_en,''), name_ar) where name is null;

alter table qt_catalogue_products
  add column if not exists name text,
  add column if not exists description text;
update qt_catalogue_products set
  name = coalesce(name, nullif(name_en,''), name_ar),
  description = coalesce(description, nullif(description_en,''), description_ar);

alter table qt_material_categories add column if not exists name text;
update qt_material_categories set name = coalesce(nullif(name_en,''), name_ar) where name is null;

alter table qt_terms_templates add column if not exists body text;
update qt_terms_templates set body = coalesce(nullif(body_en,''), body_ar) where body is null;

alter table qt_product_cost_lines add column if not exists name text;
update qt_product_cost_lines set name = coalesce(nullif(name_ar,''), name_en) where name is null;

alter table qt_qp_cost_lines add column if not exists name text;
update qt_qp_cost_lines set name = coalesce(nullif(name_ar,''), name_en) where name is null;

alter table qt_quotation_products
  add column if not exists name text,
  add column if not exists description text;
update qt_quotation_products set
  name = coalesce(name, nullif(name_en,''), name_ar),
  description = coalesce(description, nullif(description_en,''), description_ar);

-- ── 2. Drop the old bilingual columns (backed up above) ───────────────
alter table qt_materials drop column if exists name_en, drop column if exists name_ar;
alter table qt_suppliers drop column if exists name_en, drop column if exists name_ar;
alter table qt_customers drop column if exists company_name_en, drop column if exists company_name_ar;
alter table qt_labour_roles drop column if exists name_en, drop column if exists name_ar;
alter table qt_machines drop column if exists name_en, drop column if exists name_ar;
alter table qt_expense_templates drop column if exists name_en, drop column if exists name_ar;
alter table qt_catalogue_products
  drop column if exists name_en, drop column if exists name_ar,
  drop column if exists description_en, drop column if exists description_ar;
alter table qt_material_categories drop column if exists name_en, drop column if exists name_ar;
alter table qt_terms_templates drop column if exists body_en, drop column if exists body_ar;
alter table qt_product_cost_lines drop column if exists name_en, drop column if exists name_ar;
alter table qt_qp_cost_lines drop column if exists name_en, drop column if exists name_ar;
alter table qt_quotation_products
  drop column if exists name_en, drop column if exists name_ar,
  drop column if exists description_en, drop column if exists description_ar;

-- ── 3. Rebuild search indexes on the single columns ───────────────────
drop index if exists qt_materials_search_idx;
create index if not exists qt_materials_search1_idx on qt_materials
  using gin ((coalesce(name,'') || ' ' || coalesce(code,'') || ' ' || coalesce(barcode,'')) gin_trgm_ops);
drop index if exists qt_customers_search_idx;
create index if not exists qt_customers_search1_idx on qt_customers
  using gin ((coalesce(company_name,'') || ' ' || coalesce(contact_person,'') || ' ' || coalesce(phone,'')) gin_trgm_ops);
drop index if exists qt_suppliers_search_idx;
create index if not exists qt_suppliers_search1_idx on qt_suppliers
  using gin ((coalesce(name,'')) gin_trgm_ops);
drop index if exists qt_catalogue_search_idx;
create index if not exists qt_catalogue_search1_idx on qt_catalogue_products
  using gin ((coalesce(name,'') || ' ' || coalesce(category,'') || ' ' || coalesce(sku,'') || ' ' || coalesce(code,'')) gin_trgm_ops);

-- ── 4. Translation cache (server-side, shared by all users) ───────────
create table if not exists qt_translations (
  id bigserial primary key,
  source_hash text not null,          -- md5(lower(source_text))
  target_lang char(2) not null,       -- 'en' | 'ar'
  source_text text not null,
  translated text not null,
  source text not null default 'dictionary',   -- dictionary | manual | api
  created_at timestamptz not null default now(),
  unique (source_hash, target_lang)
);
create index if not exists qt_translations_idx on qt_translations (source_hash, target_lang);
