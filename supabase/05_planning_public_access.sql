-- QOS : quantité planifiée et accès direct, sans compte.
-- Base existante : exécuter après 01, 03 et 04. Aucune réimportation nécessaire.
-- Toute personne disposant de l'URL et de la clé publique peut consulter,
-- ajouter et modifier l'atelier. Les suppressions et les membres restent privés.
begin;

alter table public.production_records add column if not exists planned_qty integer;
alter table public.production_records drop constraint if exists production_planned_qty_valid;
alter table public.production_records add constraint production_planned_qty_valid
  check (planned_qty is null or planned_qty >= 0);
comment on column public.production_records.planned_qty is
  'Quantité planifiée en pièces pour ce relevé (date, poste, presse, article). NULL = non renseignée, 0 = zéro prévu. Ne modifie pas le TRS.';

-- On conserve la RLS et les contraintes métier des migrations précédentes.
do $$ declare t text; begin
  foreach t in array array['presses','articles','production_records'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists open_workshop_read on public.%I',t);
    execute format('drop policy if exists open_workshop_insert on public.%I',t);
    execute format('drop policy if exists open_workshop_update on public.%I',t);
    execute format('create policy open_workshop_read on public.%I for select to anon, authenticated using (true)',t);
    execute format('create policy open_workshop_insert on public.%I for insert to anon, authenticated with check (true)',t);
    execute format('create policy open_workshop_update on public.%I for update to anon, authenticated using (true) with check (true)',t);
  end loop;
end $$;
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.presses, public.articles, public.production_records to anon, authenticated;
grant select on public.production_metrics to anon, authenticated;
revoke delete, truncate, references, trigger on public.presses, public.articles, public.production_records from anon, authenticated;
revoke all on public.workshop_members from anon;
-- Le trigger d'origine utilise auth.uid(), qui reste NULL sans compte.
grant usage on schema auth to anon;
grant execute on function auth.uid() to anon;

-- Vérification explicite par le site : une ancienne base privée ne doit pas
-- apparaître silencieusement comme un atelier vide.
create or replace function public.qos_public_access_ready() returns boolean
language sql stable set search_path='' as $$ select true $$;
revoke all on function public.qos_public_access_ready() from public;
grant execute on function public.qos_public_access_ready() to anon, authenticated;
commit;
notify pgrst, 'reload schema';
