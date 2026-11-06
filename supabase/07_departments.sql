-- Apply after migrations 01 through 06. Existing data remains in Injection.
begin;

alter table public.presses add column if not exists department text not null default 'injection';
alter table public.articles add column if not exists department text not null default 'injection';
alter table public.production_records add column if not exists department text not null default 'injection';
do $$ declare t text; begin
  foreach t in array array['presses','articles','production_records'] loop
    execute format('alter table public.%I drop constraint if exists department_valid', t);
    execute format('alter table public.%I add constraint department_valid check (department in (''injection'',''assembly'',''welding'',''metallization'',''screen-printing''))', t);
  end loop;
end $$;

alter table public.presses drop constraint if exists presses_name_key;
alter table public.articles drop constraint if exists articles_code_key;
drop index if exists public.presses_name_ci;
drop index if exists public.articles_code_ci;
create unique index presses_name_ci on public.presses(department, lower(name));
create unique index articles_code_ci on public.articles(department, lower(code));
create unique index if not exists presses_department_identity on public.presses(id, department);
create unique index if not exists articles_department_identity on public.articles(id, department);
create index if not exists production_department_date on public.production_records(department, date);

alter table public.production_records drop constraint if exists production_press_department;
alter table public.production_records add constraint production_press_department foreign key (press_id, department) references public.presses(id, department);
alter table public.production_records drop constraint if exists production_article_department;
alter table public.production_records add constraint production_article_department foreign key (article_id, department) references public.articles(id, department);

alter table public.articles add column if not exists standard_operators numeric check (standard_operators > 0);
alter table public.articles add column if not exists trs_target numeric check (trs_target > 0 and trs_target <= 1);
alter table public.articles add column if not exists dle_target numeric check (dle_target > 0 and dle_target <= 1);
alter table public.production_records add column if not exists standard_operators numeric check (standard_operators > 0);
alter table public.production_records add column if not exists trs_target numeric check (trs_target > 0 and trs_target <= 1);
alter table public.production_records add column if not exists dle_target numeric check (dle_target > 0 and dle_target <= 1);
alter table public.articles drop constraint if exists article_department_parameters;
alter table public.articles add constraint article_department_parameters check (
  department in ('injection','welding') or (cavities = 1 and standard_operators is not null and trs_target is not null and dle_target is not null)
);
alter table public.production_records drop constraint if exists production_department_losses;
alter table public.production_records add constraint production_department_losses check (
  (department <> 'assembly' or (mold_breakdown_min = 0 and peripherals_min = 0)) and
  (department <> 'screen-printing' or mold_breakdown_min = 0) and
  (department <> 'metallization' or breakdown_min = 0)
);

-- Categories keep their stable technical fields, scoped by department.
comment on column public.production_records.mold_breakdown_min is 'Injection: panne moule. Metallisation: panne Vaccum. Zero elsewhere.';
comment on column public.production_records.peripherals_min is 'Injection: peripheriques. Metallisation: ligne peinture. Serigraphie: four. Zero en Assemblage.';

create or replace function public.keep_department_identity() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.department is distinct from old.department then
    raise exception 'Une reference ou un releve ne peut pas changer de departement.' using errcode='23514';
  end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['presses','articles','production_records'] loop
    execute format('drop trigger if exists keep_department_identity on public.%I', t);
    execute format('create trigger keep_department_identity before update on public.%I for each row execute function public.keep_department_identity()', t);
  end loop;
end $$;

create or replace function public.prepare_production_record() returns trigger
language plpgsql set search_path='' as $$
declare a public.articles; p_active boolean;
begin
  select * into a from public.articles where id=new.article_id and department=new.department;
  select active into p_active from public.presses where id=new.press_id and department=new.department;
  if a.id is null or p_active is null then
    raise exception 'Choisissez un equipement et un article de ce departement.' using errcode='23514';
  end if;
  if TG_OP='INSERT' or new.article_id is distinct from old.article_id then
    if a.active is not true then raise exception 'Article inactif'; end if;
    new.cycle_seconds := a.mold_cycle_seconds/a.cavities;
    new.standard_seconds := a.standard_seconds;
    new.standard_operators := a.standard_operators;
    new.trs_target := a.trs_target;
    new.dle_target := a.dle_target;
  else
    new.cycle_seconds := old.cycle_seconds;
    new.standard_seconds := old.standard_seconds;
    new.standard_operators := old.standard_operators;
    new.trs_target := old.trs_target;
    new.dle_target := old.dle_target;
  end if;
  if TG_OP='INSERT' or new.press_id is distinct from old.press_id then
    if p_active is not true then raise exception 'Equipement inactif'; end if;
  end if;
  if TG_OP='UPDATE' then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;

-- User-supplied catalog; no production records are created.
insert into public.presses(id, department, name, active) values
('70000000-0000-4000-8000-100000000000', 'assembly', 'Ligne Assemblage', true),
('70000000-0000-4000-8000-200000000000', 'metallization', 'Ligne Métallisation', true),
('70000000-0000-4000-8000-300000000000', 'screen-printing', 'Ligne Sérigraphie', true)
on conflict do nothing;

insert into public.articles(id, department, name, code, cavities, mold_cycle_seconds, standard_seconds, standard_operators, trs_target, dle_target, active) values
('71000000-0000-4000-8000-100000000001', 'assembly', 'Compact KIKO', '3.3.30273', 1, 3.26, 42.35, 13, .8, .8, true),
('71000000-0000-4000-8000-200000000001', 'metallization', 'Cover KIKO', '2.3.30156', 1, .75, 22.5, 30, .7, .7, true),
('71000000-0000-4000-8000-200000000002', 'metallization', 'Base KIKO', '2.4.30050', 1, .75, 22.5, 30, .7, .7, true),
('71000000-0000-4000-8000-200000000003', 'metallization', 'Cover PM Belotti', '11600CO', 1, .75, 22.5, 30, .7, .7, true),
('71000000-0000-4000-8000-200000000004', 'metallization', 'Base PM Belotti', '11600BD', 1, .75, 22.5, 30, .7, .7, true),
('71000000-0000-4000-8000-200000000005', 'metallization', 'Cover GM Belotti', '12900CO', 1, 1.036, 31.08, 30, .7, .7, true),
('71000000-0000-4000-8000-200000000006', 'metallization', 'Cover GM Belotti', '12900BD', 1, 1.036, 31.08, 30, .7, .7, true),
('71000000-0000-4000-8000-300000000001', 'screen-printing', 'Base KIKO', '2.4.30051', 1, 5, 7.5, 1.5, .8, .8, true)
on conflict do nothing;

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
  losses.staffing_min, losses.mold_breakdown_min, losses.peripherals_min, losses.material_shortage_min, losses.quality_stop_min, losses.power_cut_min, losses.adjustment_min, losses.other_loss_min,
  losses.department, losses.standard_operators, losses.trs_target, losses.dle_target
from base join (select id as loss_id, staffing_min, mold_breakdown_min, peripherals_min, material_shortage_min, quality_stop_min, power_cut_min, adjustment_min, other_loss_min, department, standard_operators, trs_target, dle_target from public.production_records) losses on losses.loss_id=base.id;

create or replace function public.qos_departments_ready() returns boolean
language sql stable set search_path='' as $$ select true $$;
revoke all on function public.qos_departments_ready() from public;
grant execute on function public.qos_departments_ready() to anon, authenticated;
commit;
notify pgrst, 'reload schema';
