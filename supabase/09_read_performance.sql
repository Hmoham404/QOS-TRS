-- Apply after migrations 01 through 08. Supports department-scoped cursor
-- pagination without scanning and skipping all preceding production records.
-- No data, business constraints or access policies are changed.
begin;
create index if not exists production_records_department_id
  on public.production_records(department, id);
commit;
