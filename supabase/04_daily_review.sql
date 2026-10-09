-- QOS / Bilan J-1 : cohérence des horaires de chaque presse.
-- Exécuter APRES 01_schema.sql et 03_stop_journal.sql.
-- Idempotent. Aucune donnée historique n'est supprimée ni recalculée.
begin;
create index if not exists production_press_date on public.production_records(press_id,date);

create or replace function public.prevent_press_schedule_overlap() returns trigger
language plpgsql set search_path='' as $$
declare start_at timestamp; end_at timestamp;
begin
  if not new.timeline_complete then return new; end if;
  if new.shift_start is null or extract(second from new.shift_start)<>0 then
    raise exception 'Le début du journal doit être une heure valide à la minute près.' using errcode='23514';
  end if;
  start_at:=new.date+new.shift_start;
  end_at:=start_at+new.opening_min*interval '1 minute';
  -- Une transaction à la fois par presse, y compris en saisie simultanée.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.press_id::text,0));
  if exists (
    select 1 from public.production_records r
    where r.press_id=new.press_id and r.id<>new.id and r.timeline_complete
      and r.date between new.date-1 and new.date+1
      and r.date+r.shift_start < end_at
      and start_at < r.date+r.shift_start+r.opening_min*interval '1 minute'
  ) then
    raise exception 'Cette presse possède déjà un journal sur ce créneau. Corrigez le début ou la durée du relevé.' using errcode='23514';
  end if;
  return new;
end $$;
drop trigger if exists prevent_press_schedule_overlap on public.production_records;
create trigger prevent_press_schedule_overlap before insert or update on public.production_records
for each row execute function public.prevent_press_schedule_overlap();

comment on column public.production_records.date is 'Date locale du début du poste. Le poste de nuit reste rattaché à cette date après minuit.';
comment on column public.production_records.shift_start is 'Heure locale réelle du début du relevé, à la minute. Les horaires proposés par poste sont modifiables.';
commit;
notify pgrst, 'reload schema';

-- Diagnostic non destructif : renvoie les éventuels anciens chevauchements.
-- La migration ne modifie pas ces lignes ; corriger leurs journaux dans le site.
select a.id as releve_1,b.id as releve_2,p.name as presse,a.date as date_1,b.date as date_2
from public.production_records a
join public.production_records b on a.press_id=b.press_id and a.id<b.id
join public.presses p on p.id=a.press_id
where a.timeline_complete and b.timeline_complete
  and a.date+a.shift_start < b.date+b.shift_start+b.opening_min*interval '1 minute'
  and b.date+b.shift_start < a.date+a.shift_start+a.opening_min*interval '1 minute';
