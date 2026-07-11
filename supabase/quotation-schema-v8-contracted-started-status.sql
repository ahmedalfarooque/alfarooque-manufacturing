-- Extend qt_quotations.status with two new lifecycle stages appended
-- after the existing accepted/sent flow: 'contracted' (signed, ready to
-- schedule) and 'started' (work begins — this is what surfaces the
-- "Send to Projects" action). Nothing existing is removed or changed.
-- Idempotent: safe to re-run.

alter table qt_quotations drop constraint if exists qt_quotations_status_check;
alter table qt_quotations add constraint qt_quotations_status_check check (status in
  ('draft','pending_approval','approved','sent','accepted','rejected',
   'expired','superseded','cancelled','contracted','started'));

notify pgrst, 'reload schema';
