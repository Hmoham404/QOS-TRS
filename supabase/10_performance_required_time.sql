-- Calcul de la performance sur le temps requis, sans modifier les données.
begin;
create or replace view public.production_metrics with (security_invoker=true) as
with base as (
  select r.id,r.date,r.shift,r.press_id,r.article_id,r.opening_min,r.planned_min,
    r.breakdown_min,r.startup_min,r.changeover_min,r.good_qty,r.startup_rejects,
    r.production_rejects,r.labor_hours,r.cycle_seconds,r.standard_seconds,r.notes,
    r.source,r.source_row,r.created_by,r.created_at,r.updated_at,
    opening_min-planned_min as required_min,
    opening_min-planned_min-staffing_min-mold_breakdown_min-breakdown_min-peripherals_min-material_shortage_min-quality_stop_min-power_cut_min-adjustment_min-other_loss_min-startup_min-changeover_min as runtime_min,
    good_qty+startup_rejects+production_rejects as total_qty,
    good_qty*standard_seconds/3600 as earned_hours
  from public.production_records r
)
select base.*,
  runtime_min/nullif(required_min,0) as availability,
  total_qty*cycle_seconds/nullif(required_min*60,0) as performance,
  good_qty::numeric/nullif(total_qty,0) as quality,
  good_qty*cycle_seconds/nullif(required_min*60,0) as trs,
  earned_hours/nullif(labor_hours,0) as dle,
  losses.staffing_min, losses.mold_breakdown_min, losses.peripherals_min, losses.material_shortage_min, losses.quality_stop_min, losses.power_cut_min, losses.adjustment_min, losses.other_loss_min,
  losses.department, losses.standard_operators, losses.trs_target, losses.dle_target
from base join (select id as loss_id, staffing_min, mold_breakdown_min, peripherals_min, material_shortage_min, quality_stop_min, power_cut_min, adjustment_min, other_loss_min, department, standard_operators, trs_target, dle_target from public.production_records) losses on losses.loss_id=base.id;

commit;
notify pgrst, 'reload schema';
