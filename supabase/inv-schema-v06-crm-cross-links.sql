-- =============================================================================
-- AL FAROOQUE ERP — CRM Cross-App Links
-- Version: inv-schema-v06-crm-cross-links
-- Run AFTER inv-schema-v05-purchasing-destination.sql
--
-- Lets a CRM deal reference the Quotation and/or Project it originated
-- from, so sales staff can trace a deal back to the actual quote/project
-- record in the Quotation and Projects apps without duplicating data.
-- =============================================================================

alter table crm_deals
  add column if not exists linked_quotation_id uuid references qt_quotations(id) on delete set null,
  add column if not exists linked_project_id   uuid references pm_projects(id) on delete set null;

create index if not exists idx_crm_deals_quotation on crm_deals(linked_quotation_id);
create index if not exists idx_crm_deals_project   on crm_deals(linked_project_id);
