-- =============================================================================
-- AL FAROOQUE ERP — CRM Schema Correction
-- Version: inv-schema-v10-crm-schema-fix
-- Run AFTER inv-schema-v09-crm-settings.sql (which itself runs after
-- inv-schema-v06-crm-cross-links.sql, the ALTER this file's recreate
-- absorbs — see note below).
--
-- WHY THIS FILE EXISTS
-- crm_contacts / crm_deals / crm_activities in inv-schema-v02-cross-app.sql
-- were drafted independently from the Next.js API routes in
-- apps/crm/app/api/** that were actually built against them — same class
-- of drift already fixed once for Accounting in
-- inv-schema-v04-accounting-schema-fix.sql. Found by the production-
-- readiness audit: column names, casing, and even the data model
-- disagree (first_name/last_name vs a single name field, a stage_id FK
-- vs a plain stage string, lowercase enum values vs the Capitalized
-- values the UI actually sends — which the old CHECK constraints would
-- reject outright). Since these tables have never been deployed to
-- Supabase (zero rows), this file safely DROPs and re-CREATEs each one to
-- match the working application code, using the application code as the
-- source of truth — the same policy the Accounting fix used. If this has
-- already been run against a database with real rows, do NOT run this
-- file — write a data-preserving migration instead.
--
-- Concrete mismatches fixed here:
--   crm_contacts   : first_name/last_name -> single `name`; is_customer/is_active -> contact_type/status; adds tags
--   crm_deals      : stage_id (FK)         -> stage (text); close_date -> expected_close_date; notes -> description;
--                     status lowercase set -> Capitalized set; folds in the linked_quotation_id/linked_project_id
--                     columns inv-schema-v06-crm-cross-links.sql added by ALTER (recreating the table would
--                     otherwise drop them)
--   crm_activities : due_date -> activity_date (date, not timestamptz); duration_min -> duration_minutes;
--                     activity_type set adds 'demo'; status lowercase set -> Capitalized set
-- =============================================================================

drop table if exists crm_activities;
drop table if exists crm_deals;
drop table if exists crm_contacts;

-- ---------------------------------------------------------------------------
-- crm_contacts  (people — leads, prospects, customers, partners, suppliers)
-- ---------------------------------------------------------------------------
create table crm_contacts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text,
  phone        text,
  company      text,
  job_title    text,
  contact_type text not null default 'Lead' check (contact_type in ('Lead','Prospect','Customer','Partner','Supplier')),
  status       text,
  source       text,
  address      text,
  notes        text,
  tags         text[],
  assigned_to  uuid references platform_users(id),
  created_by   uuid references platform_users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_crm_contacts_email    on crm_contacts(email);
create index idx_crm_contacts_company  on crm_contacts(company);
create index idx_crm_contacts_assigned on crm_contacts(assigned_to);
create index idx_crm_contacts_type     on crm_contacts(contact_type);

-- ---------------------------------------------------------------------------
-- crm_deals  (pipeline opportunities)
-- ---------------------------------------------------------------------------
create table crm_deals (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  contact_id          uuid references crm_contacts(id),
  stage               text not null default 'Prospecting' check (stage in
                        ('Prospecting','Qualification','Proposal','Negotiation','Closed Won','Closed Lost')),
  value               numeric(16,4) not null default 0,
  currency            text not null default 'SAR',
  expected_close_date date,
  probability         numeric(5,2),
  status              text not null default 'Open' check (status in ('Open','Won','Lost','On Hold')),
  description         text,
  linked_quotation_id uuid references qt_quotations(id) on delete set null,
  linked_project_id   uuid references pm_projects(id) on delete set null,
  assigned_to         uuid references platform_users(id),
  created_by          uuid references platform_users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_crm_deals_stage      on crm_deals(stage);
create index idx_crm_deals_status     on crm_deals(status);
create index idx_crm_deals_assigned   on crm_deals(assigned_to);
create index idx_crm_deals_close      on crm_deals(expected_close_date);
create index idx_crm_deals_quotation  on crm_deals(linked_quotation_id);
create index idx_crm_deals_project    on crm_deals(linked_project_id);

-- ---------------------------------------------------------------------------
-- crm_activities  (calls, meetings, emails, demos, follow-ups, tasks, notes)
-- ---------------------------------------------------------------------------
create table crm_activities (
  id               uuid primary key default gen_random_uuid(),
  activity_type    text not null check (activity_type in ('Call','Meeting','Email','Demo','Follow-up','Task','Note')),
  subject          text not null,
  activity_date    date not null default current_date,
  duration_minutes int,
  contact_id       uuid references crm_contacts(id),
  deal_id          uuid references crm_deals(id),
  notes            text,
  outcome          text,
  status           text not null default 'Planned' check (status in ('Planned','Completed','Cancelled','No Show')),
  assigned_to      uuid references platform_users(id),
  created_by       uuid references platform_users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_crm_act_type     on crm_activities(activity_type);
create index idx_crm_act_status   on crm_activities(status);
create index idx_crm_act_contact  on crm_activities(contact_id);
create index idx_crm_act_deal     on crm_activities(deal_id);
create index idx_crm_act_date     on crm_activities(activity_date);

-- Row Level Security intentionally disabled — service-role key used
-- server-side only, same pattern as every other table in this project.
