-- ════════════════════════════════════════════════════════════════════
-- Quotation PDF system update:
--  1. Add optional 'website' to qt_entities (shown in the PDF footer
--     only when set — no existing rows are affected beyond adding a
--     null column).
--  2. Strip the hardcoded "50% advance payment, balance on delivery."
--     clause out of the seeded Terms & Conditions text — payment terms
--     now live in their own dynamic per-quotation field (payment_terms,
--     already existed on qt_quotations) instead of being baked into the
--     shared terms template. Rest of the terms text is untouched.
-- Safe to re-run (idempotent).
-- ════════════════════════════════════════════════════════════════════

alter table qt_entities add column if not exists website text;

-- qt_terms_templates was converted to a single-language 'body' column by
-- quotation-schema-v4-single-language.sql (translated on the fly at
-- render time) — strip the hardcoded payment clause from whichever
-- script it's currently stored in.
update qt_terms_templates
   set body = trim(both ' ' from replace(replace(body,
         '50% advance payment, balance on delivery. ', ''),
         'دفعة مقدمة 50٪ والباقي عند التسليم. ', ''))
 where body like '%50% advance payment, balance on delivery.%'
    or body like '%دفعة مقدمة 50٪ والباقي عند التسليم.%';

notify pgrst, 'reload schema';
