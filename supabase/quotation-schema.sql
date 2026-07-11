-- ════════════════════════════════════════════════════════════════════
-- AL FAROOQUE — Quotation & Cost Estimation System (apps/quotation)
-- Isolated qt_* tables in the shared Supabase project. Identity reuses
-- platform_users (created by supabase/apps-schema.sql — run that first).
-- Apply in Supabase Dashboard → SQL Editor → New query → Run.
-- Spec: apps/quotation/docs/Quotation System Master Specification.md §11
-- Safe to re-run: everything is IF NOT EXISTS / ON CONFLICT DO NOTHING.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- ── Common audit columns are: created_by/updated_by (platform_users.id),
--    created_at/updated_at, deleted_at (soft delete). ──────────────────

-- ═══ 1. ENTITIES & SETTINGS ═══════════════════════════════════════════

create table if not exists qt_entities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                       -- 'WW-03' | 'IAAE'
  name_en text not null,
  name_ar text,
  cr_number text,
  vat_number text,
  address_en text,
  address_ar text,
  phone text,
  email text,
  website text,
  logo_path text,
  default_vat_rate numeric(5,2) not null default 15,
  quote_prefix text not null,                      -- 'WW-03' | 'IAAE'
  next_seq int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists qt_settings (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references qt_entities(id),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (entity_id, key)
);

create table if not exists qt_terms_templates (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid references qt_entities(id),
  title text not null,
  body_en text,
  body_ar text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ═══ 2. PARTIES ═══════════════════════════════════════════════════════

create table if not exists qt_customers (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  company_name_ar text,
  company_name_en text,
  contact_person text,
  phone text,
  phone2 text,
  email text,
  address text,
  city text default 'Jeddah',
  customer_type text default 'other',              -- hotel|contractor|individual|engineer|government|other
  vat_number text,
  cr_number text,
  tags text[] default '{}',
  notes text,
  status text not null default 'active',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists qt_customers_search_idx on qt_customers
  using gin ((coalesce(company_name_ar,'') || ' ' || coalesce(company_name_en,'') || ' ' || coalesce(contact_person,'') || ' ' || coalesce(phone,'')) gin_trgm_ops);

create table if not exists qt_customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references qt_customers(id) on delete cascade,
  name text not null,
  role text,
  phone text,
  email text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists qt_suppliers (
  id uuid primary key default gen_random_uuid(),
  name_ar text,
  name_en text,
  contact_person text,
  phone text,
  email text,
  address text,
  vat_number text,
  cr_number text,
  categories text[] default '{}',
  payment_terms text,
  rating smallint,
  notes text,
  status text not null default 'active',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists qt_suppliers_search_idx on qt_suppliers
  using gin ((coalesce(name_ar,'') || ' ' || coalesce(name_en,'')) gin_trgm_ops);

create table if not exists qt_projects (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name_ar text,
  name_en text,
  customer_id uuid references qt_customers(id),
  entity_id uuid references qt_entities(id),
  location text,
  project_type text,
  status text not null default 'lead',             -- lead|quoting|awarded|in_production|delivered|closed|lost
  start_date date,
  end_date date,
  notes text,
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ═══ 3. MATERIAL MASTER ═══════════════════════════════════════════════

create table if not exists qt_material_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references qt_material_categories(id),
  name_en text not null,
  name_ar text,
  kind text not null default 'material' check (kind in ('material','hardware')),
  sort int not null default 0
);

create table if not exists qt_materials (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  barcode text,
  name_ar text,
  name_en text,
  category_id uuid references qt_material_categories(id),
  kind text not null default 'material' check (kind in ('material','hardware')),
  material_type text,
  thickness text,
  size_text text,
  unit text not null default 'piece',
  brand text,
  default_supplier_id uuid references qt_suppliers(id),
  latest_price numeric(14,2) not null default 0,
  currency char(3) not null default 'SAR',
  default_waste_pct numeric(6,3) not null default 0,
  min_price numeric(14,2),
  max_price numeric(14,2),
  is_certified boolean not null default false,
  cert_notes text,
  image_path text,
  notes text,
  status text not null default 'active',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists qt_materials_search_idx on qt_materials
  using gin ((coalesce(name_ar,'') || ' ' || coalesce(name_en,'') || ' ' || coalesce(code,'') || ' ' || coalesce(barcode,'')) gin_trgm_ops);
create index if not exists qt_materials_cat_idx on qt_materials (category_id, status);

create table if not exists qt_material_price_history (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references qt_materials(id) on delete cascade,
  price numeric(14,4) not null,
  previous_price numeric(14,4),
  supplier_id uuid references qt_suppliers(id),
  source text not null default 'manual',           -- manual|bulk|import|purchase_report
  source_ref text,
  effective_date date not null default current_date,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists qt_mph_idx on qt_material_price_history (material_id, effective_date desc);

create table if not exists qt_material_suppliers (
  material_id uuid not null references qt_materials(id) on delete cascade,
  supplier_id uuid not null references qt_suppliers(id) on delete cascade,
  last_price numeric(14,4),
  last_purchase_at date,
  supplier_code text,
  primary key (material_id, supplier_id)
);

-- ═══ 4. LABOUR / MACHINES / EXPENSES ══════════════════════════════════

create table if not exists qt_labour_roles (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text,
  hourly_rate numeric(14,2) not null default 0,
  daily_rate numeric(14,2) not null default 0,
  monthly_rate numeric(14,2) not null default 0,
  overtime_multiplier numeric(4,2) not null default 1.5,
  default_unit text not null default 'day' check (default_unit in ('hour','day','month')),
  notes text,
  status text not null default 'active',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists qt_labour_rate_history (
  id uuid primary key default gen_random_uuid(),
  labour_role_id uuid not null references qt_labour_roles(id) on delete cascade,
  field text not null,
  old_value numeric(14,2),
  new_value numeric(14,2),
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists qt_machines (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name_en text not null,
  name_ar text,
  category text,
  hourly_cost numeric(14,2) not null default 0,
  setup_cost numeric(14,2) not null default 0,
  notes text,
  status text not null default 'active',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists qt_expense_templates (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ar text,
  category text not null default 'miscellaneous',  -- transport|fuel|installation|accommodation|packaging|food|miscellaneous|consumables|equipment_rental
  default_amount numeric(14,2) not null default 0,
  unit text not null default 'fixed' check (unit in ('fixed','per_day','per_trip','per_unit','pct_production')),
  notes text,
  status text not null default 'active',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ═══ 5. PRODUCT CATALOGUE ═════════════════════════════════════════════

create table if not exists qt_catalogue_products (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name_en text,
  name_ar text,
  category text,
  description_en text,
  description_ar text,
  unit text not null default 'nos',
  standard_price numeric(14,2) not null default 0,
  last_calculated_cost numeric(14,2),
  last_costed_at timestamptz,
  image_path text,
  tags text[] default '{}',
  status text not null default 'active',
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists qt_catalogue_search_idx on qt_catalogue_products
  using gin ((coalesce(name_ar,'') || ' ' || coalesce(name_en,'') || ' ' || coalesce(category,'')) gin_trgm_ops);

-- Template cost model lines (snapshot fields — BR-4: masters never
-- cascade into lines; source_id is a soft reference only).
create table if not exists qt_product_cost_lines (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references qt_catalogue_products(id) on delete cascade,
  section text not null check (section in ('material','hardware','labour','machine','expense','other')),
  source_id uuid,
  sort int not null default 0,
  name_ar text,
  name_en text,
  spec_text text,
  unit text,
  qty numeric(14,3) not null default 1,
  unit_cost numeric(14,4) not null default 0,
  waste_pct numeric(6,3) not null default 0,
  extra jsonb not null default '{}'::jsonb,        -- {setup_cost, pct_of_production, supplier_name, …}
  line_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists qt_pcl_idx on qt_product_cost_lines (product_id, sort);

create table if not exists qt_catalogue_price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references qt_catalogue_products(id) on delete cascade,
  price numeric(14,2) not null,
  cost numeric(14,2),
  created_by uuid,
  created_at timestamptz not null default now()
);

-- ═══ 6. QUOTATIONS ════════════════════════════════════════════════════

create table if not exists qt_quotations (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references qt_entities(id),
  quote_number text not null,
  revision int not null default 0,
  parent_id uuid references qt_quotations(id),     -- previous revision
  root_id uuid,                                    -- revision family root
  customer_id uuid references qt_customers(id),
  project_id uuid references qt_projects(id),
  salesperson_id uuid,                             -- platform_users.id
  status text not null default 'draft' check (status in
    ('draft','pending_approval','approved','sent','accepted','rejected',
     'expired','superseded','cancelled')),
  quote_date date not null default current_date,
  valid_until date,
  output_lang char(2) not null default 'en',
  currency char(3) not null default 'SAR',
  payment_terms text,
  delivery_terms text,
  customer_notes text,
  internal_notes text,
  terms_template_id uuid references qt_terms_templates(id),
  terms_body_override text,
  discount_type text not null default 'pct' check (discount_type in ('pct','amount')),
  discount_value numeric(14,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  discount_amount numeric(14,2) not null default 0,
  net_total numeric(14,2) not null default 0,
  vat_rate numeric(5,2) not null default 15,
  vat_amount numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  total_cost numeric(14,2) not null default 0,
  blended_margin_pct numeric(6,3),
  follow_up_at date,
  follow_up_note text,
  won_lost_reason text,
  competitor text,
  public_token uuid not null default gen_random_uuid(),
  created_by uuid, updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create unique index if not exists qt_quotations_number_uidx on qt_quotations (quote_number) where deleted_at is null;
create index if not exists qt_quotations_list_idx on qt_quotations (entity_id, status, quote_date desc);
create index if not exists qt_quotations_customer_idx on qt_quotations (customer_id);
create index if not exists qt_quotations_root_idx on qt_quotations (root_id);

create table if not exists qt_quotation_products (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references qt_quotations(id) on delete cascade,
  sort int not null default 0,
  catalogue_product_id uuid references qt_catalogue_products(id),
  name_en text,
  name_ar text,
  description_en text,
  description_ar text,
  unit text not null default 'nos',
  qty numeric(14,3) not null default 1,
  unit_price numeric(14,2) not null default 0,
  taxable boolean not null default true,
  line_discount numeric(14,2) not null default 0,
  line_total numeric(14,2) not null default 0,
  image_path text,
  -- costing rollups (null for quick-quote lines without a cost model):
  production_cost numeric(14,2),
  overhead_pct numeric(6,3),
  overhead_amount numeric(14,2),
  risk_pct numeric(6,3),
  risk_amount numeric(14,2),
  total_cost numeric(14,2),
  profit_mode text check (profit_mode in ('pct','fixed','selling')),
  profit_value numeric(14,2),
  profit_amount numeric(14,2),
  margin_pct numeric(6,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists qt_qp_idx on qt_quotation_products (quotation_id, sort);

create table if not exists qt_qp_cost_lines (
  id uuid primary key default gen_random_uuid(),
  quotation_product_id uuid not null references qt_quotation_products(id) on delete cascade,
  section text not null check (section in ('material','hardware','labour','machine','expense','other')),
  source_id uuid,
  sort int not null default 0,
  name_ar text,
  name_en text,
  spec_text text,
  unit text,
  qty numeric(14,3) not null default 1,
  unit_cost numeric(14,4) not null default 0,
  waste_pct numeric(6,3) not null default 0,
  extra jsonb not null default '{}'::jsonb,
  line_total numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists qt_qpcl_idx on qt_qp_cost_lines (quotation_product_id, sort);

create table if not exists qt_quotation_events (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references qt_quotations(id) on delete cascade,
  event text not null,                             -- created|submitted|approved|rejected|sent_email|sent_link|accepted|rejected_by_customer|expired|revised|cancelled
  detail jsonb not null default '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists qt_qe_idx on qt_quotation_events (quotation_id, created_at desc);

create table if not exists qt_quotation_approvals (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references qt_quotations(id) on delete cascade,
  requested_by uuid not null,
  approver_id uuid,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reason text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);

-- ═══ 7. UX SUPPORT & OPS ══════════════════════════════════════════════

create table if not exists qt_favorites (
  user_id uuid not null,
  item_type text not null,                         -- material|catalogue_product|customer
  item_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

create table if not exists qt_recent_items (
  user_id uuid not null,
  item_type text not null,
  item_id uuid not null,
  used_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

create table if not exists qt_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null default 'info',
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists qt_notifications_idx on qt_notifications (user_id, is_read, created_at desc);

create table if not exists qt_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,                        -- quotation|material|customer|catalogue_product|supplier|project
  owner_id uuid not null,
  file_path text not null,
  file_name text not null,
  mime text,
  size_bytes bigint,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists qt_attachments_idx on qt_attachments (owner_type, owner_id);

create table if not exists qt_import_jobs (
  id uuid primary key default gen_random_uuid(),
  type text not null,                              -- purchases|customers|materials|catalogue
  file_path text,
  status text not null default 'pending',          -- pending|running|done|failed
  total_rows int default 0,
  ok_rows int default 0,
  failed_rows int default 0,
  error_file_path text,
  params jsonb not null default '{}'::jsonb,
  started_by uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists qt_audit_logs (
  id bigserial primary key,
  table_name text not null,
  record_id uuid,
  action text not null,                            -- insert|update|delete|status
  old_data jsonb,
  new_data jsonb,
  actor_id uuid,
  ip text,
  created_at timestamptz not null default now()
);
create index if not exists qt_audit_idx on qt_audit_logs (table_name, record_id);

-- ═══ 8. NUMBERING FUNCTION (race-safe, per BR-3) ══════════════════════

create or replace function qt_next_quote_number(p_entity uuid)
returns text
language plpgsql
as $$
declare
  v_prefix text;
  v_seq int;
begin
  update qt_entities
     set next_seq = next_seq + 1
   where id = p_entity
   returning quote_prefix, next_seq - 1 into v_prefix, v_seq;
  if v_prefix is null then
    raise exception 'Unknown entity %', p_entity;
  end if;
  return v_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- ═══ 9. SEED DATA ═════════════════════════════════════════════════════

insert into qt_entities (code, name_en, name_ar, cr_number, address_en, address_ar, phone, quote_prefix, next_seq)
values
  ('WW-03', 'ALFAROOQUE WOOD WORKS FACTORY', 'مصنع الفاروق للأعمال الخشبية', null,
   'Bahara, Jeddah, Saudi Arabia', 'بحرة، جدة، المملكة العربية السعودية', '0590622801', 'WW-03', 1),
  ('IAAE', 'ISMAIL AL FAROOQUE GENERAL CONTRACTING', 'إسماعيل الفاروق للمقاولات العامة', '4031010693',
   'Jeddah, Saudi Arabia', 'جدة، المملكة العربية السعودية', '0564466661', 'IAAE', 1)
on conflict (code) do nothing;

insert into qt_settings (entity_id, key, value)
select null, 'profit_defaults', '{"overhead_pct":10,"risk_pct":3,"profit_pct":25,"rounding":0}'::jsonb
where not exists (select 1 from qt_settings where key = 'profit_defaults' and entity_id is null);

insert into qt_settings (entity_id, key, value)
select null, 'approval_thresholds', '{"amount":50000,"min_margin_pct":15,"max_discount_pct":10}'::jsonb
where not exists (select 1 from qt_settings where key = 'approval_thresholds' and entity_id is null);

insert into qt_settings (entity_id, key, value)
select null, 'defaults', '{"validity_days":7,"currency":"SAR","vat_rate":15}'::jsonb
where not exists (select 1 from qt_settings where key = 'defaults' and entity_id is null);

insert into qt_labour_roles (name_en, name_ar, hourly_rate, daily_rate, monthly_rate, default_unit)
select * from (values
  ('Carpenter',        'نجار',           25::numeric, 200::numeric, 4500::numeric, 'day'),
  ('Senior Carpenter', 'نجار أول',       35, 280, 6500, 'day'),
  ('Helper',           'مساعد',          12, 100, 2200, 'day'),
  ('Painter',          'دهان',           25, 200, 4500, 'day'),
  ('Installer',        'فني تركيب',      25, 220, 5000, 'day'),
  ('Supervisor',       'مشرف',           40, 320, 7500, 'day'),
  ('Designer',         'مصمم',           45, 360, 8000, 'day'),
  ('Project Engineer', 'مهندس مشروع',    55, 440, 10000, 'day')
) v(name_en, name_ar, hourly_rate, daily_rate, monthly_rate, default_unit)
where not exists (select 1 from qt_labour_roles);

insert into qt_expense_templates (name_en, name_ar, category, default_amount, unit)
select * from (values
  ('Transport — Jeddah',      'نقل — جدة',        'transport',        350::numeric, 'per_trip'),
  ('Fuel',                    'وقود',             'fuel',             150, 'per_day'),
  ('Installation Team',       'فريق تركيب',       'installation',     0,   'per_day'),
  ('Accommodation',           'سكن',              'accommodation',    120, 'per_day'),
  ('Packaging',               'تغليف',            'packaging',        0,   'per_unit'),
  ('Food Allowance',          'بدل طعام',         'food',             50,  'per_day'),
  ('Consumables',             'مستهلكات',         'consumables',      2,   'pct_production'),
  ('Equipment Rental',        'تأجير معدات',      'equipment_rental', 0,   'per_day'),
  ('Miscellaneous',           'متنوعة',           'miscellaneous',    0,   'fixed')
) v(name_en, name_ar, category, default_amount, unit)
where not exists (select 1 from qt_expense_templates);

insert into qt_material_categories (name_en, name_ar, kind, sort)
select * from (values
  ('Sheet Boards (MDF / Plywood / Chipboard)', 'ألواح (MDF / بلايوود / خشب مضغوط)', 'material', 1),
  ('Solid Wood',            'خشب طبيعي',        'material', 2),
  ('Veneer & Laminates',    'قشرة وفورمايكا',    'material', 3),
  ('Paints & Finishes',     'دهانات وتشطيبات',   'material', 4),
  ('Glass',                 'زجاج',             'material', 5),
  ('Aluminium & Steel',     'ألمنيوم وحديد',     'material', 6),
  ('Adhesives & Consumables','مواد لاصقة ومستهلكات','material', 7),
  ('Upholstery & Fabric',   'تنجيد وأقمشة',      'material', 8),
  ('Hinges',                'مفصلات',           'hardware', 20),
  ('Locks & Cylinders',     'أقفال وكوالين',     'hardware', 21),
  ('Handles',               'مساكات',           'hardware', 22),
  ('Screws & Fixings',      'براغي ومثبتات',     'hardware', 23),
  ('Drawer Slides & Fittings','سكك وفتنجات',     'hardware', 24),
  ('Accessories',           'إكسسوارات',        'hardware', 25)
) v(name_en, name_ar, kind, sort)
where not exists (select 1 from qt_material_categories);

insert into qt_terms_templates (entity_id, title, body_en, body_ar, is_default)
select e.id, 'Standard Terms',
  'Prices are valid for 7 days from the quotation date. Delivery period to be confirmed on order. Prices include VAT where stated.',
  'الأسعار سارية لمدة 7 أيام من تاريخ العرض. يتم تأكيد مدة التسليم عند الطلب. الأسعار تشمل الضريبة حيثما ذُكر.',
  true
from qt_entities e
where not exists (select 1 from qt_terms_templates);
