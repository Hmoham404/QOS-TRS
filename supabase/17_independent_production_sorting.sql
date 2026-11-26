-- Apply after 01 through 16. Production and sorting can share the same date,
-- shift, equipment and article while duplicates within one activity stay blocked.
begin;

-- Remove only the generated sorting prefix, preserving user edits and history.
update public.articles destination
set name = source.name
from public.articles source
where source.department = 'metallization' and destination.department = 'assembly'
  and destination.id = (
    lpad(to_hex((('x' || left(source.id::text, 8))::bit(32)::integer # 50331648)), 8, '0')
    || substring(source.id::text from 9)
  )::uuid
  and destination.name = 'Tri · ' || left(source.name, 154);

alter table public.production_records
  drop constraint if exists production_records_date_shift_press_id_article_id_key;

-- Keep this predicate aligned with src/sorting.js; no new record columns.
create unique index if not exists production_records_activity_key
on public.production_records (
  date, shift, press_id, article_id,
  (case when
    coalesce(sorting_hours, 0) > 0 and opening_min > 0 and planned_min = opening_min
    and good_qty = 0 and startup_rejects = 0 and production_rejects = 0
    and labor_hours = 0 and breakdown_min = 0 and startup_min = 0 and changeover_min = 0
    and staffing_min = 0 and mold_breakdown_min = 0 and peripherals_min = 0
    and material_shortage_min = 0 and quality_stop_min = 0 and power_cut_min = 0
    and adjustment_min = 0 and other_loss_min = 0
    and coalesce(planned_qty, 0) <= 0
    and coalesce(operator_count, 0) * coalesce(labor_duration_hours, 0) = 0
    and not coalesce(timeline_complete, false)
    then 'sorting' else 'production' end)
);
commit;
notify pgrst, 'reload schema';
