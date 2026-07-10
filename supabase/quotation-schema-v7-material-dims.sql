-- Structured, unit-aware material dimensions (height/width/length/thickness).
-- Replaces the free-text `thickness`/`size_text` pair with four optional
-- value+unit columns. Old columns are kept (not dropped) so nothing is lost;
-- existing `thickness` text is best-effort parsed into thickness_value/unit,
-- `size_text` is left untouched (too ambiguous to safely split into W×L).
-- Idempotent: safe to re-run.

alter table qt_materials
  add column if not exists height_value numeric(12,3),
  add column if not exists height_unit text,
  add column if not exists width_value numeric(12,3),
  add column if not exists width_unit text,
  add column if not exists length_value numeric(12,3),
  add column if not exists length_unit text,
  add column if not exists thickness_value numeric(12,3),
  add column if not exists thickness_unit text;

do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'qt_materials' and column_name = 'thickness') then
    update qt_materials
    set
      thickness_value = nullif(substring(thickness from '([0-9]+(\.[0-9]+)?)'), '')::numeric,
      thickness_unit = case
        when thickness ~* 'mm' then 'mm'
        when thickness ~* 'cm' then 'cm'
        when thickness ~* 'meter|metre|(^|[^m])m($|[^m])' then 'meter'
        else 'mm'
      end
    where thickness_value is null
      and thickness is not null
      and thickness ~ '[0-9]';
  end if;
end $$;

notify pgrst, 'reload schema';
