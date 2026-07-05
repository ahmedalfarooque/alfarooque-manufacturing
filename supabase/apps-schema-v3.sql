-- ═══════════════════════════════════════════════════════════════════
-- AL FAROOQUE — Projects app, schema v3 (additive)
-- Run AFTER apps-schema.sql and apps-schema-v2.sql. Adds customer
-- management (including VAT/CR numbers), links pm_projects to it, and
-- extends pm_projects with contact/detail fields for the full Project
-- View page. Does not alter or drop anything in the earlier schema
-- files or touch existing project rows (every new column is nullable —
-- the 29 already-imported projects keep working exactly as before).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  company_name  text,
  email         text,
  mobile_number text,
  vat_number    text,
  cr_number     text,
  address       text,
  city          text,
  country       text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_customers_full_name on public.customers(full_name);
alter table public.customers enable row level security;
-- in case this runs after an earlier partial apply that already created the table without these columns
alter table public.customers add column if not exists vat_number text;
alter table public.customers add column if not exists cr_number text;

drop trigger if exists trg_customers_touch on public.customers;
create trigger trg_customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();

-- Link projects to a real customer record. Nullable + on delete set
-- null so nothing breaks for existing rows or if a customer is later
-- removed — pm_projects.customer_name/company_name (already existing
-- text columns) remain the display fallback either way.
alter table public.pm_projects add column if not exists customer_id uuid references public.customers(id) on delete set null;
create index if not exists idx_pm_projects_customer on public.pm_projects(customer_id);

-- Extended project fields for the full Project View page. project_name
-- stays SHORT (dashboard/table display); project_details holds the
-- full description. For the 29 already-imported rows, a one-off
-- migration script moves their current long project_name into
-- project_details and generates a short project_name — schema change
-- only, no data touched by this SQL file itself.
alter table public.pm_projects add column if not exists contact_person text;
alter table public.pm_projects add column if not exists contact_email text;
alter table public.pm_projects add column if not exists contact_phone text;
alter table public.pm_projects add column if not exists address text;
alter table public.pm_projects add column if not exists short_summary text;
alter table public.pm_projects add column if not exists project_details text;

-- Storage bucket for project images/drawings/documents — public read
-- (internal work-order photos/drawings, not confidential), writes only
-- via the server's service-role key (never directly from the browser).
insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', true)
on conflict (id) do nothing;
-- ═══════════════════════════════════════════════════════════════════
