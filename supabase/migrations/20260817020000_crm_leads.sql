-- Additive: CRM Leads module. No existing "lead" table/concept found in the
-- ERP (audited 2026-08-17) — crm_contacts.contact_type only has a 'Lead'
-- enum value with no lead-specific fields (source, score, next follow-up).
-- This table is CRM-owned only; it does not duplicate any customer/quotation/
-- project/invoice master data and does not touch existing tables.

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  contact_person text,
  phone text,
  email text,
  source text,
  industry text,
  city text,
  assigned_to uuid references public.platform_users(id),
  status text not null default 'New' check (status in ('New','Contacted','Qualified','Unqualified','Converted','Lost')),
  score numeric,
  notes text,
  next_follow_up date,
  converted_contact_id uuid references public.crm_contacts(id),
  converted_deal_id uuid references public.crm_deals(id),
  converted_at timestamptz,
  created_by uuid references public.platform_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_leads_status on public.crm_leads(status);
create index if not exists idx_crm_leads_assigned_to on public.crm_leads(assigned_to);
create index if not exists idx_crm_leads_created_at on public.crm_leads(created_at desc);
