-- Shared customer database between apps/quotation and apps/projects.
-- Both already point at the same Supabase project; this migration makes
-- public.customers the single source of truth by absorbing qt_customers'
-- extra bilingual/company fields, then repointing qt_quotations at it.
-- Idempotent: safe to re-run. qt_customers is left in place (unused,
-- not dropped) as a safety net.

alter table public.customers
  add column if not exists company_name_en text,
  add column if not exists company_name_ar text,
  add column if not exists contact_person text,
  add column if not exists contact_person_en text,
  add column if not exists contact_person_ar text,
  add column if not exists phone2 text,
  add column if not exists customer_type text,
  add column if not exists status text not null default 'active',
  add column if not exists code text,
  add column if not exists tags text[],
  add column if not exists deleted_at timestamptz,
  add column if not exists created_by uuid,
  add column if not exists updated_by uuid;

-- Merge qt_customers rows into public.customers, preserving the same id
-- so existing qt_quotations.customer_id references keep working
-- unchanged. Only inserts rows not already present (safe to re-run).
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'qt_customers') then
    insert into public.customers
      (id, full_name, company_name, company_name_en, company_name_ar, contact_person,
       contact_person_en, contact_person_ar, email, mobile_number, phone2, vat_number,
       cr_number, address, city, customer_type, status, code, tags, notes,
       created_by, updated_by, created_at, updated_at)
    select
      qc.id,
      coalesce(qc.company_name_en, qc.company_name_ar, qc.company_name, 'Unnamed'),
      qc.company_name,
      qc.company_name_en,
      qc.company_name_ar,
      qc.contact_person,
      qc.contact_person_en,
      qc.contact_person_ar,
      qc.email,
      qc.phone,
      qc.phone2,
      qc.vat_number,
      qc.cr_number,
      qc.address,
      qc.city,
      qc.customer_type,
      coalesce(qc.status, 'active'),
      qc.code,
      qc.tags,
      qc.notes,
      qc.created_by,
      qc.updated_by,
      qc.created_at,
      qc.updated_at
    from qt_customers qc
    where qc.deleted_at is null
      and not exists (select 1 from public.customers c where c.id = qc.id);
  end if;
end $$;

-- If an earlier partial run created `tags` as plain text, fix its type.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'customers'
               and column_name = 'tags' and data_type <> 'ARRAY') then
    alter table public.customers alter column tags type text[] using
      case when tags is null or tags = '' then null else string_to_array(tags, ',') end;
  end if;
end $$;

-- Backfill columns added in a later revision of this migration for rows
-- that were already merged by an earlier run (the insert above only
-- fires for rows not yet present, so re-running after adding new
-- columns needs this separate backfill pass). Only fills nulls.
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'qt_customers') then
    update public.customers c set
      contact_person_en = coalesce(c.contact_person_en, qc.contact_person_en),
      contact_person_ar = coalesce(c.contact_person_ar, qc.contact_person_ar),
      code = coalesce(c.code, qc.code),
      tags = coalesce(c.tags, qc.tags),
      created_by = coalesce(c.created_by, qc.created_by),
      updated_by = coalesce(c.updated_by, qc.updated_by)
    from qt_customers qc
    where c.id = qc.id;
  end if;
end $$;

-- Repoint the FK so quotations reference the shared table.
do $$
begin
  if exists (select 1 from information_schema.table_constraints
             where constraint_name = 'qt_quotations_customer_id_fkey') then
    alter table qt_quotations drop constraint qt_quotations_customer_id_fkey;
  end if;
  alter table qt_quotations
    add constraint qt_quotations_customer_id_fkey
    foreign key (customer_id) references public.customers(id);
end $$;

notify pgrst, 'reload schema';
