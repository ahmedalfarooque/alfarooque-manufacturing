-- ════════════════════════════════════════════════════════════════════
-- Quotation app — schema v2 (Phase 2: Catalogue & Costing)
-- Run AFTER quotation-schema.sql. Idempotent.
-- Adds per-product costing parameters (overhead %, risk %, profit mode/
-- value, rounding) used by the cost-model editor, stored as jsonb so
-- the pure costing engine's options round-trip exactly.
-- ════════════════════════════════════════════════════════════════════

alter table qt_catalogue_products
  add column if not exists cost_params jsonb not null default
    '{"overheadPct":10,"riskPct":3,"profitMode":"pct","profitValue":25,"rounding":0}'::jsonb;
