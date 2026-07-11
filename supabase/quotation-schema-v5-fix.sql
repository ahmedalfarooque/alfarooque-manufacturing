-- ════════════════════════════════════════════════════════════════════
-- Quotation app — v5 FIX: run this ONE file to bring any database to
-- the current schema. It safely (re)applies everything from v3 and v4
-- (idempotent — skips whatever already exists), keeps all data, and
-- finishes by reloading the PostgREST schema cache, which fixes:
--   "Could not find the 'sub_category' column of 'qt_catalogue_products'
--    in the schema cache"
-- Prerequisites: quotation-schema.sql and quotation-schema-v2.sql.
-- ════════════════════════════════════════════════════════════════════

-- ═══ v3: product/supplier upgrades, roles, product-code sequence ═══════
alter table qt_catalogue_products
  add column if not exists sub_category text,
  add column if not exists sku text,
  add column if not exists barcode text,
  add column if not exists dimensions jsonb not null default '{}'::jsonb,
  add column if not exists images jsonb not null default '[]'::jsonb,
  add column if not exists notes text;

create index if not exists qt_catalogue_subcat_idx on qt_catalogue_products (category, sub_category);
create index if not exists qt_catalogue_sku_idx on qt_catalogue_products (sku);

create sequence if not exists qt_product_code_seq;
select setval('qt_product_code_seq',
  greatest(
    coalesce((select max(nullif(regexp_replace(code, '\D', '', 'g'), '')::bigint)
              from qt_catalogue_products where code ~ '^P-\d+$'), 0),
    coalesce((select last_value from qt_product_code_seq), 0), 1));

create or replace function qt_next_product_code()
returns text language sql as
$$ select 'P-' || lpad(nextval('qt_product_code_seq')::text, 6, '0') $$;

alter table qt_quotation_products
  add column if not exists dimensions jsonb not null default '{}'::jsonb,
  add column if not exists base_dimensions jsonb not null default '{}'::jsonb;

alter table qt_suppliers
  add column if not exists country text default 'Saudi Arabia',
  add column if not exists currency char(3) default 'SAR',
  add column if not exists bank_name text,
  add column if not exists iban text,
  add column if not exists contacts jsonb not null default '[]'::jsonb;

create table if not exists qt_user_roles (
  user_id uuid primary key,
  role text not null default 'readonly' check (role in
    ('admin','manager','sales','estimator','accountant','production','readonly')),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into qt_settings (entity_id, key, value)
select null, 'translation', '{"auto":true}'::jsonb
where not exists (select 1 from qt_settings where key = 'translation' and entity_id is null);
insert into qt_settings (entity_id, key, value)
select null, 'numbering', '{"product_prefix":"P-","product_pad":6}'::jsonb
where not exists (select 1 from qt_settings where key = 'numbering' and entity_id is null);

-- ═══ v4: single-language data model (backup → merge → drop pairs) ══════
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

alter table qt_materials add column if not exists name text;
alter table qt_suppliers add column if not exists name text;
alter table qt_customers add column if not exists company_name text;
alter table qt_labour_roles add column if not exists name text;
alter table qt_machines add column if not exists name text;
alter table qt_expense_templates add column if not exists name text;
alter table qt_catalogue_products
  add column if not exists name text,
  add column if not exists description text;
alter table qt_material_categories add column if not exists name text;
alter table qt_terms_templates add column if not exists body text;
alter table qt_product_cost_lines add column if not exists name text;
alter table qt_qp_cost_lines add column if not exists name text;
alter table qt_quotation_products
  add column if not exists name text,
  add column if not exists description text;

do $$
begin
  if exists (select 1 from information_schema.columns where table_name='qt_materials' and column_name='name_en') then
    update qt_materials set name = coalesce(name, nullif(name_ar,''), name_en);
    update qt_suppliers set name = coalesce(name, nullif(name_ar,''), name_en);
    update qt_customers set company_name = coalesce(company_name, nullif(company_name_ar,''), company_name_en);
    update qt_labour_roles set name = coalesce(name, nullif(name_en,''), name_ar);
    update qt_machines set name = coalesce(name, nullif(name_en,''), name_ar);
    update qt_expense_templates set name = coalesce(name, nullif(name_en,''), name_ar);
    update qt_catalogue_products set
      name = coalesce(name, nullif(name_en,''), name_ar),
      description = coalesce(description, nullif(description_en,''), description_ar);
    update qt_material_categories set name = coalesce(name, nullif(name_en,''), name_ar);
    update qt_terms_templates set body = coalesce(body, nullif(body_en,''), body_ar);
    update qt_product_cost_lines set name = coalesce(name, nullif(name_ar,''), name_en);
    update qt_qp_cost_lines set name = coalesce(name, nullif(name_ar,''), name_en);
    update qt_quotation_products set
      name = coalesce(name, nullif(name_en,''), name_ar),
      description = coalesce(description, nullif(description_en,''), description_ar);
  end if;
end $$;

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

create table if not exists qt_translations (
  id bigserial primary key,
  source_hash text not null,
  target_lang char(2) not null,
  source_text text not null,
  translated text not null,
  source text not null default 'dictionary',
  created_at timestamptz not null default now(),
  unique (source_hash, target_lang)
);
create index if not exists qt_translations_idx on qt_translations (source_hash, target_lang);

-- ═══ Only the product name is mandatory — everything else optional ═════
alter table qt_catalogue_products alter column unit set default 'nos';
alter table qt_catalogue_products alter column standard_price set default 0;

-- ═══ Reload PostgREST schema cache (fixes the schema-cache error) ══════
notify pgrst, 'reload schema';
