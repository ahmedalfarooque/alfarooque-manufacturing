-- ════════════════════════════════════════════════════════════════════
-- Rename the Wood Works entity's internal code from 'WW' to 'WW-03'.
-- Data-only change: the qt_entities row's id (and therefore every
-- existing quotation's entity_id foreign key) is untouched — only the
-- code/quote_prefix strings on that one row change, so no historical
-- record is reassigned or modified. Safe to re-run (no-op once applied).
-- ════════════════════════════════════════════════════════════════════

update qt_entities
   set code = 'WW-03',
       quote_prefix = 'WW-03',
       updated_at = now()
 where code = 'WW';

notify pgrst, 'reload schema';
