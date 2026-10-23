-- QOS : catégories de pertes. Appliquer après les migrations 01, 03, 04 et 05.
-- Les anciens relevés conservent leurs valeurs ; les nouvelles pertes démarrent à zéro.
begin;
alter table public.production_records add column if not exists staffing_min numeric not null default 0 check (staffing_min>=0);
alter table public.production_records add column if not exists mold_breakdown_min numeric not null default 0 check (mold_breakdown_min>=0);
alter table public.production_records add column if not exists peripherals_min numeric not null default 0 check (peripherals_min>=0);
alter table public.production_records add column if not exists material_shortage_min numeric not null default 0 check (material_shortage_min>=0);
alter table public.production_records add column if not exists quality_stop_min numeric not null default 0 check (quality_stop_min>=0);
alter table public.production_records add column if not exists power_cut_min numeric not null default 0 check (power_cut_min>=0);
alter table public.production_records add column if not exists adjustment_min numeric not null default 0 check (adjustment_min>=0);
alter table public.production_records add column if not exists other_loss_min numeric not null default 0 check (other_loss_min>=0);
alter table public.production_records drop constraint if exists production_all_losses_valid;
alter table public.production_records add constraint production_all_losses_valid check (
  opening_min-planned_min-staffing_min-mold_breakdown_min-breakdown_min-peripherals_min-material_shortage_min-quality_stop_min-power_cut_min-adjustment_min-other_loss_min-startup_min-changeover_min>=0 and (opening_min-planned_min-staffing_min-mold_breakdown_min-breakdown_min-peripherals_min-material_shortage_min-quality_stop_min-power_cut_min-adjustment_min-other_loss_min-startup_min-changeover_min>0 or good_qty+startup_rejects+production_rejects=0)
);

create or replace function public.valid_stop_journal_v2(
  complete boolean, start_at time, events jsonb, opening numeric, expected jsonb
) returns boolean language plpgsql immutable set search_path='' as $$
declare e jsonb; start_min numeric; end_min numeric; last_end numeric:=0;
  category text; totals jsonb:='{}'::jsonb; expected_category text;
begin
  if events is null or jsonb_typeof(events)<>'array' then return false; end if;
  if not complete then return jsonb_array_length(events)=0; end if;
  if start_at is null or start_at >= time '24:00' or jsonb_array_length(events)>100 then return false; end if;
  for e in select value from jsonb_array_elements(events) order by (value->>'start_min')::numeric loop
    category:=e->>'category';
    if jsonb_typeof(e)<>'object'
      or jsonb_typeof(e->'start_min') is distinct from 'number'
      or jsonb_typeof(e->'end_min') is distinct from 'number'
      or jsonb_typeof(e->'cause') is distinct from 'string'
      or category is null or not (expected ? category)
      or length(e->>'cause')>120 then return false; end if;
    start_min:=(e->>'start_min')::numeric; end_min:=(e->>'end_min')::numeric;
    if start_min<0 or end_min<=start_min or end_min>opening or start_min<last_end then return false; end if;
    last_end:=end_min;
    totals:=jsonb_set(totals,array[category],to_jsonb(coalesce((totals->>category)::numeric,0)+end_min-start_min));
  end loop;
  for expected_category in select jsonb_object_keys(expected) loop
    if abs(coalesce((totals->>expected_category)::numeric,0)-(expected->>expected_category)::numeric)>=0.000001 then return false; end if;
  end loop;
  return true;
exception when others then return false;
end $$;
alter table public.production_records drop constraint if exists production_stop_journal_valid;
alter table public.production_records add constraint production_stop_journal_valid check (
  public.valid_stop_journal_v2(timeline_complete,shift_start,stop_events,opening_min,
    jsonb_build_object('staffing',staffing_min,'mold',mold_breakdown_min,'breakdown',breakdown_min,'peripherals',peripherals_min,'material',material_shortage_min,'quality_stop',quality_stop_min,'power',power_cut_min,'adjustment',adjustment_min,'other',other_loss_min,'startup',startup_min,'changeover',changeover_min,'planned',planned_min))
);

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
  total_qty*cycle_seconds/nullif(runtime_min*60,0) as performance,
  good_qty::numeric/nullif(total_qty,0) as quality,
  good_qty*cycle_seconds/nullif(required_min*60,0) as trs,
  earned_hours/nullif(labor_hours,0) as dle,
  losses.staffing_min, losses.mold_breakdown_min, losses.peripherals_min, losses.material_shortage_min, losses.quality_stop_min, losses.power_cut_min, losses.adjustment_min, losses.other_loss_min
from base join (select id as loss_id, staffing_min, mold_breakdown_min, peripherals_min, material_shortage_min, quality_stop_min, power_cut_min, adjustment_min, other_loss_min from public.production_records) losses on losses.loss_id=base.id;


commit;
notify pgrst, 'reload schema';
