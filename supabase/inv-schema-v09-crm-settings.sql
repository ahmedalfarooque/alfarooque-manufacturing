-- =============================================================================
-- AL FAROOQUE ERP — CRM Settings table
-- Version: inv-schema-v09-crm-settings
-- Run AFTER inv-schema-v08-sales-orders.sql
--
-- CRM's own app/api/settings/route.js reads/writes a `crm_settings` table
-- that was never defined in any migration file — the Settings page would
-- 404 against a real database (found by the production-readiness audit).
-- Single-row settings table, same shape/pattern as acc_settings
-- (supabase/inv-schema-v04-accounting-schema-fix.sql).
-- =============================================================================

create table if not exists crm_settings (
  id                          uuid primary key default gen_random_uuid(),
  company_name                text,
  default_currency            text not null default 'SAR',
  deal_stages                 jsonb,
  activity_types              jsonb,
  contact_sources             jsonb,
  win_probability_threshold   numeric(5,2) not null default 70,
  updated_at                  timestamptz not null default now()
);

-- Row Level Security intentionally disabled — service-role key used
-- server-side only, same pattern as every other table in this project.
