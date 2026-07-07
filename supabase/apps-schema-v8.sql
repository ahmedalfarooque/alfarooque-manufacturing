-- ═══════════════════════════════════════════════════════════════════
-- AL FAROOQUE — ProTrack: Assigned-User Email Notification & full
-- Notification Center type dictionary
--
-- Fully ADDITIVE. Adds one nullable column to the existing
-- `notifications` table (from apps-schema-v7.sql) — no data loss, no
-- existing row touched. Run once in Supabase Dashboard → SQL Editor →
-- New query → Run.
-- ═══════════════════════════════════════════════════════════════════

-- Notifications: explicit project reference (previously only carried
-- implicitly inside `link`) so the client can group/filter by project
-- without parsing the link string.
alter table public.notifications add column if not exists project_id uuid references public.pm_projects(id) on delete cascade;
create index if not exists idx_notifications_project on public.notifications(project_id);

-- ═══════════════════════════════════════════════════════════════════
-- Notification `type` dictionary now in use (plain text column, no
-- CHECK constraint — additive, matches the app's existing convention):
--   project_assigned | purchase_request | purchase_approved | purchase_rejected
--   daily_update_approved | daily_update_rejected | project_updated
--   document_added | comment_added
-- ═══════════════════════════════════════════════════════════════════
