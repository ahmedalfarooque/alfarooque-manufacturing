-- ═══════════════════════════════════════════════════════════════════════════
-- AL FAROOQUE ERP — Schema v12
-- Contracts module + customer-decision workflow + project tracking / comments
--
-- SAFETY: This migration is ADDITIVE and BACKWARD-COMPATIBLE.
--   • No column is dropped or renamed.
--   • No existing enum is altered (status columns are TEXT, so new status
--     values need no type change and existing rows keep their values).
--   • Every new table uses IF NOT EXISTS; every new column uses ADD COLUMN
--     IF NOT EXISTS. Re-running the file is safe (idempotent).
--   • Existing quotations, customers, projects, reports keep working
--     unchanged — the new statuses/tables are only used by the new flows.
--
-- Apply against the Supabase project AFTER reviewing. It does not touch or
-- delete any existing data.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. QUOTATION — customer decision + rejection history (items 2–4)
--    Statuses are stored in qt_quotations.status (TEXT). The workflow now
--    recognises these values (existing ones unchanged, new ones added):
--      draft, pending_approval, approved, sent,
--      submitted,                         -- explicit "submitted to customer"
--      customer_accepted, customer_rejected,
--      contracted,                        -- accepted, work starts w/o contract
--      contract_submitted, contract_accepted,
--      project_sent,                      -- ONE standardized send-to-projects status
--      project_rejected,                  -- rejected by the project team
--      -- legacy values kept for backward compatibility: accepted, rejected, started
--    No DB constraint enforces the set (matches the existing TEXT design), so
--    old rows remain valid and the app layer owns the transitions.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE qt_quotations ADD COLUMN IF NOT EXISTS rejection_reason      TEXT;
ALTER TABLE qt_quotations ADD COLUMN IF NOT EXISTS rejected_by           UUID;
ALTER TABLE qt_quotations ADD COLUMN IF NOT EXISTS rejected_at           TIMESTAMPTZ;
ALTER TABLE qt_quotations ADD COLUMN IF NOT EXISTS customer_decided_by   UUID;
ALTER TABLE qt_quotations ADD COLUMN IF NOT EXISTS customer_decided_at   TIMESTAMPTZ;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. BANK ACCOUNTS (item: company bank accounts module)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qt_bank_accounts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name     TEXT NOT NULL,
  bank_name_ar  TEXT,
  account_name  TEXT NOT NULL,
  account_number TEXT,
  iban          TEXT,
  swift         TEXT,
  branch        TEXT,
  currency      TEXT DEFAULT 'SAR',
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now(),
  created_by    UUID,
  updated_at    TIMESTAMPTZ DEFAULT now(),
  updated_by    UUID
);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. CONTRACTS (items 6–9) — created from a quotation OR standalone.
--    References quotation + customer; links to the project once forwarded.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qt_contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT UNIQUE NOT NULL,          -- e.g. CT-2026-0001 (app-generated)
  quotation_id    UUID REFERENCES qt_quotations(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES qt_customers(id) ON DELETE SET NULL,
  project_id      UUID,                           -- linked after Send to Projects (projects app id)
  bank_account_id UUID REFERENCES qt_bank_accounts(id) ON DELETE SET NULL,

  -- status: contract_submitted → contract_accepted → project_sent (standardized)
  status          TEXT NOT NULL DEFAULT 'contract_submitted',

  title           TEXT,
  title_ar        TEXT,
  output_lang     TEXT DEFAULT 'both',            -- 'en' | 'ar' | 'both' (side-by-side)
  contract_date   DATE DEFAULT CURRENT_DATE,
  currency        TEXT DEFAULT 'SAR',
  grand_total     NUMERIC(14,2) DEFAULT 0,

  -- editable clauses + rich-text notes (stored as JSON/HTML; app renders)
  clauses         JSONB DEFAULT '[]'::jsonb,      -- [{ heading, heading_ar, body, body_ar, sort }]
  notes_html      TEXT,                           -- rich text (sanitized on render)
  notes_html_ar   TEXT,

  -- snapshot of customer/project details at contract time (bilingual safe)
  customer_snapshot JSONB DEFAULT '{}'::jsonb,
  project_snapshot  JSONB DEFAULT '{}'::jsonb,

  accepted_by     UUID,
  accepted_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ DEFAULT now(),
  created_by      UUID,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  updated_by      UUID,
  deleted_at      TIMESTAMPTZ                      -- soft delete (matches existing pattern)
);
CREATE INDEX IF NOT EXISTS idx_qt_contracts_quotation ON qt_contracts(quotation_id);
CREATE INDEX IF NOT EXISTS idx_qt_contracts_customer  ON qt_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_qt_contracts_status    ON qt_contracts(status) WHERE deleted_at IS NULL;

-- Dynamic payment schedule — unlimited milestones, %/amount, per contract.
CREATE TABLE IF NOT EXISTS qt_contract_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID NOT NULL REFERENCES qt_contracts(id) ON DELETE CASCADE,
  sort_order    INT DEFAULT 0,
  label         TEXT,
  label_ar      TEXT,
  percent       NUMERIC(6,3),                     -- e.g. 30.000 (app auto-calcs amount + remaining)
  amount        NUMERIC(14,2),
  due_condition TEXT,                             -- free text: "On signing", "On delivery", …
  due_date      DATE,
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qt_contract_payments_contract ON qt_contract_payments(contract_id);

-- Attachments (PDF / Word / images) — merged into the generated contract PDF.
CREATE TABLE IF NOT EXISTS qt_contract_attachments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   UUID NOT NULL REFERENCES qt_contracts(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL,
  file_type     TEXT,                             -- mime
  storage_path  TEXT NOT NULL,                    -- Supabase Storage path
  size_bytes    BIGINT,
  merge_into_pdf BOOLEAN DEFAULT TRUE,
  sort_order    INT DEFAULT 0,
  uploaded_at   TIMESTAMPTZ DEFAULT now(),
  uploaded_by   UUID
);
CREATE INDEX IF NOT EXISTS idx_qt_contract_attachments_contract ON qt_contract_attachments(contract_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 4. PROJECT TRACKING / COMMUNICATION (items 13–18)
--    A threaded timeline shared between Quotation and Projects apps, keyed by
--    quotation and/or project. Email replies (inbound) land here too once the
--    provider webhook is wired — see the API integration point in the app.
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qt_track_threads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id  UUID REFERENCES qt_quotations(id) ON DELETE CASCADE,
  project_id    UUID,                             -- projects app id (nullable until forwarded)
  contract_id   UUID REFERENCES qt_contracts(id) ON DELETE SET NULL,
  subject       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  created_by    UUID
);
CREATE INDEX IF NOT EXISTS idx_qt_track_threads_quotation ON qt_track_threads(quotation_id);
CREATE INDEX IF NOT EXISTS idx_qt_track_threads_project   ON qt_track_threads(project_id);

CREATE TABLE IF NOT EXISTS qt_track_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id     UUID NOT NULL REFERENCES qt_track_threads(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL DEFAULT 'comment',  -- 'request' | 'reply' | 'comment' | 'system'
  body          TEXT,
  author_id     UUID,
  author_name   TEXT,                             -- denormalized for email-origin replies
  author_email  TEXT,
  source        TEXT DEFAULT 'app',               -- 'app' | 'email'
  email_message_id TEXT,                          -- for inbound-reply dedupe/threading
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qt_track_messages_thread ON qt_track_messages(thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_qt_track_messages_email  ON qt_track_messages(email_message_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 5. PROJECT ↔ QUOTATION STATUS SYNC
--    The quotation↔project link + sync already exists (apps-schema-v11).
--    The new standardized statuses (project_sent, project_rejected) flow
--    through that existing mechanism and the application layer — no new
--    columns on the orders table are added here, to avoid conflicting with
--    the v11 sync schema. If a dedicated mirror column proves necessary
--    after v11 is inspected against the live DB, add it in a follow-up
--    migration (v13) rather than guessing the table shape here.
-- ─────────────────────────────────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════════════════
-- End of v12. Nothing above drops or rewrites existing data.
-- ═══════════════════════════════════════════════════════════════════════════
