-- Phase 1: allow a Purchase Request to exist independently of a Project,
-- so it can be created from Accounting first and connected to a Project
-- later. No data is touched — every existing row already has a non-null
-- project_id and is unaffected by relaxing the constraint.
--
-- The Purchase Request <-> Purchase Invoice link does NOT need a new table:
-- erp_financial_connections already has a purchase_request_id column
-- (FK -> pm_purchase_requests, ON DELETE SET NULL) from a prior migration.
-- This migration only removes the NOT NULL on pm_purchase_requests.project_id.

alter table public.pm_purchase_requests
  alter column project_id drop not null;
