-- Ajouter le journal d'arrêts à une base QOS déjà installée.
-- Aucune donnée historique n'est modifiée. Exécutable plusieurs fois.
begin;
alter table public.production_records add column if not exists shift_start time;
alter table public.production_records add column if not exists timeline_complete boolean not null default false;
alter table public.production_records add column if not exists stop_events jsonb not null default '[]'::jsonb;

create or replace function public.valid_stop_journal(
  complete boolean, start_at time, events jsonb, opening numeric,
  planned numeric, breakdown numeric, startup numeric, changeover numeric
) returns boolean language plpgsql immutable set search_path='' as $$
declare e jsonb; start_min numeric; end_min numeric; last_end numeric:=0;
  planned_sum numeric:=0; breakdown_sum numeric:=0; startup_sum numeric:=0; changeover_sum numeric:=0;
begin
  if events is null or jsonb_typeof(events)<>'array' then return false; end if;
  if not complete then return jsonb_array_length(events)=0; end if;
  if start_at is null or start_at >= time '24:00' or jsonb_array_length(events)>100 then return false; end if;
  for e in select value from jsonb_array_elements(events) order by (value->>'start_min')::numeric loop
    if jsonb_typeof(e)<>'object'
      or jsonb_typeof(e->'start_min') is distinct from 'number'
      or jsonb_typeof(e->'end_min') is distinct from 'number'
      or jsonb_typeof(e->'cause') is distinct from 'string'
      or e->>'category' is null
      or e->>'category' not in ('planned','breakdown','startup','changeover')
      or length(e->>'cause')>120 then return false; end if;
    start_min:=(e->>'start_min')::numeric; end_min:=(e->>'end_min')::numeric;
    if start_min<0 or end_min<=start_min or end_min>opening or start_min<last_end then return false; end if;
    last_end:=end_min;
    case e->>'category'
      when 'planned' then planned_sum:=planned_sum+end_min-start_min;
      when 'breakdown' then breakdown_sum:=breakdown_sum+end_min-start_min;
      when 'startup' then startup_sum:=startup_sum+end_min-start_min;
      when 'changeover' then changeover_sum:=changeover_sum+end_min-start_min;
    end case;
  end loop;
  return abs(planned_sum-planned)<0.000001 and abs(breakdown_sum-breakdown)<0.000001
    and abs(startup_sum-startup)<0.000001 and abs(changeover_sum-changeover)<0.000001;
exception when others then return false;
end $$;
alter table public.production_records drop constraint if exists production_stop_journal_valid;
alter table public.production_records add constraint production_stop_journal_valid check (
  public.valid_stop_journal(timeline_complete,shift_start,stop_events,opening_min,planned_min,breakdown_min,startup_min,changeover_min)
);
comment on column public.production_records.stop_events is 'Intervalles sans chevauchement, en minutes depuis shift_start : {id,start_min,end_min,category,cause}.';
comment on column public.production_records.timeline_complete is 'Tous les arrêts sont renseignés. Le reste du relevé est considéré comme de la marche déclarée, pas une mesure capteur.';
commit;
notify pgrst, 'reload schema';
