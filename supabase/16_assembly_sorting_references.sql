-- Apply after 01 through 15. No production history is copied or changed.
-- Source timings are retained for identification; these "Tri · " references
-- are selected only in the sorting entry form, never for assembly production.
-- Follow with 17_independent_production_sorting.sql to make these references
-- available for both activities and permit separate production/sorting records.
begin;
insert into public.articles (
  id, department, name, code, cavities, mold_cycle_seconds,
  standard_seconds, standard_operators, trs_target, dle_target, active
)
select (
    lpad(to_hex((('x' || left(a.id::text, 8))::bit(32)::integer # 50331648)), 8, '0')
    || substring(a.id::text from 9)
  )::uuid,
  'assembly', 'Tri · ' || left(a.name, 154), a.code, 1, a.mold_cycle_seconds / a.cavities,
  a.standard_seconds, a.standard_operators, .8, .8, true
from public.articles a
where a.department = 'metallization' and a.active
  and not exists (
    select 1 from public.articles existing
    where existing.department = 'assembly' and lower(existing.code) = lower(a.code)
  )
on conflict do nothing;
commit;
notify pgrst, 'reload schema';
