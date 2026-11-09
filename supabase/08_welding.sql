-- Apply after migrations 01 through 07. No production history is created.
begin;

alter table public.articles drop constraint if exists welding_article_parameters;
alter table public.articles add constraint welding_article_parameters check (
  department <> 'welding' or (cavities = 1 and standard_operators is not null and trs_target is not null and dle_target is not null)
);
alter table public.production_records drop constraint if exists welding_production_losses;
alter table public.production_records add constraint welding_production_losses check (
  department <> 'welding' or (mold_breakdown_min = 0 and peripherals_min = 0)
);
comment on column public.production_records.material_shortage_min is 'Soudure: rupture SFIN. Autres departements: rupture MP.';

insert into public.presses(id, department, name, active) values
('70000000-0000-4000-8000-400000000000', 'welding', 'Ligne Soudure', true)
on conflict do nothing;

insert into public.articles(id, department, name, code, cavities, mold_cycle_seconds, standard_seconds, standard_operators, trs_target, dle_target, active) values
('71000000-0000-4000-8000-400000000001', 'welding', 'Base+insert soudés KIKO', '2.4.30049', 1, 5.94, 11.88, 2, .8, .8, true)
on conflict do nothing;

create or replace function public.qos_welding_ready() returns boolean
language sql stable set search_path='' as $$ select true $$;
revoke all on function public.qos_welding_ready() from public;
grant execute on function public.qos_welding_ready() to anon, authenticated;

commit;
notify pgrst, 'reload schema';
