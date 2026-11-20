-- Après les migrations 01 à 12. Les anciens relevés gardent leurs heures MOD.
begin;
alter table public.production_records add column if not exists operator_count integer;
alter table public.production_records add column if not exists labor_duration_hours numeric;
alter table public.production_records add column if not exists work_order text;
alter table public.production_records drop constraint if exists production_records_labor_inputs;
alter table public.production_records add constraint production_records_labor_inputs check (
  (operator_count is null and labor_duration_hours is null)
  or (operator_count is not null and labor_duration_hours is not null
    and operator_count between 0 and 100000
    and labor_duration_hours between 0 and 24
    and abs(labor_hours - operator_count * labor_duration_hours) < 0.000001)
);
alter table public.production_records drop constraint if exists production_records_work_order_length;
alter table public.production_records add constraint production_records_work_order_length
  check (work_order is null or length(work_order) <= 100);
create or replace function public.prepare_labor_inputs() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.operator_count is not null and new.labor_duration_hours is not null then
    new.labor_hours := new.operator_count * new.labor_duration_hours;
  end if;
  new.work_order := nullif(btrim(new.work_order), '');
  return new;
end;
$$;
drop trigger if exists aa_prepare_labor_inputs on public.production_records;
create trigger aa_prepare_labor_inputs before insert or update on public.production_records
  for each row execute function public.prepare_labor_inputs();
commit;
notify pgrst, 'reload schema';
