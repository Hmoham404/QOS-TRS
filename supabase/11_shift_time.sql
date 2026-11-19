-- Durées propres à chaque relevé. Aucune réécriture de l'historique.
begin;
alter table public.production_records
  add column if not exists pause_min numeric,
  add column if not exists meeting_min numeric,
  add column if not exists five_s_min numeric;
alter table public.production_records drop constraint if exists production_records_shift_breaks;
alter table public.production_records add constraint production_records_shift_breaks check (
  (pause_min is null and meeting_min is null and five_s_min is null)
  or (pause_min is not null and meeting_min is not null and five_s_min is not null
    and pause_min >= 0 and meeting_min >= 0 and five_s_min >= 0
    and pause_min <= 1440 and meeting_min <= 1440 and five_s_min <= 1440
    and not timeline_complete
    and abs(planned_min - pause_min - meeting_min - five_s_min) < 0.000001)
);
commit;
notify pgrst, 'reload schema';
