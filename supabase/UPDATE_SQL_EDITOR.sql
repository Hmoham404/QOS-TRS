-- MISE A JOUR QOS / TRS : à copier intégralement dans Supabase SQL Editor.
-- Pour une base existante ayant déjà reçu les migrations 01 à 08.
-- Compatible avant/après les migrations 09, 10, 11 et 12 ; rejouable.
-- Aucun relevé, référence, droit d'accès ou paramètre historique n'est réécrit.
-- Aucun exemple fictif n'est inséré dans vos données.
begin;
do $$
begin
  if to_regclass('public.production_records') is null then
    raise exception 'Base absente : installer les migrations 01 à 08 avant cette mise à jour.';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='production_records' and column_name='department')
    or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='production_records' and column_name='other_loss_min') then
    raise exception 'Base incomplète : appliquer les migrations manquantes 01 à 08 dans l ordre.';
  end if;
end $$;
alter table public.production_records
  add column if not exists pause_min numeric,
  add column if not exists meeting_min numeric,
  add column if not exists five_s_min numeric;
create index if not exists production_records_department_id
  on public.production_records(department, id);

-- L'ouverture nette exclut pause/réunion/5S. Les arrêts planifiés restent séparés.
-- Aucun recalcul des anciennes lignes, même si la migration 11 a déjà été utilisée.
alter table public.production_records add column if not exists shift_duration_min numeric;
alter table public.production_records drop constraint if exists production_records_shift_breaks;
alter table public.production_records add constraint production_records_shift_breaks check (
  shift_duration_min is null or (
    shift_duration_min > 0 and shift_duration_min <= 1440
    and pause_min is not null and meeting_min is not null and five_s_min is not null
    and pause_min >= 0 and meeting_min >= 0 and five_s_min >= 0
    and pause_min <= 1440 and meeting_min <= 1440 and five_s_min <= 1440
    and abs(opening_min - (shift_duration_min - pause_min - meeting_min - five_s_min)) < 0.000001
  )
);
-- Calcul de la performance sur le temps requis, sans modifier les données.
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
-- Vérification en lecture seule : ce résultat doit conserver votre historique.
select department, count(*) as nombre_de_releves,
  count(shift_duration_min) as releves_avec_duree_de_poste_detaillee
from public.production_records group by department order by case department
  when 'injection' then 1 when 'welding' then 2 when 'metallization' then 3
  when 'screen-printing' then 4 when 'assembly' then 5 end;
