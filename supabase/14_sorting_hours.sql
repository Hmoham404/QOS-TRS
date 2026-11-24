-- Apply after migrations 01 through 13. Existing records keep NULL sorting hours.
begin;
alter table public.production_records add column if not exists sorting_hours numeric;
alter table public.production_records drop constraint if exists production_records_sorting_hours;
alter table public.production_records add constraint production_records_sorting_hours
  check (sorting_hours is null or sorting_hours between 0 and 1000000);
commit;
notify pgrst, 'reload schema';
