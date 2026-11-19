-- L'ouverture nette exclut pause/réunion/5S. Les arrêts planifiés restent séparés.
-- Aucun recalcul des anciennes lignes, même si la migration 11 a déjà été utilisée.
begin;
alter table public.production_records add column if not exists shift_duration_min numeric;
alter table public.production_records drop constraint if exists production_records_shift_breaks;
alter table public.production_records add constraint production_records_shift_breaks check (
  shift_duration_min is null or (
    shift_duration_min > 0 and shift_duration_min <= 1440
    and pause_min is not null and meeting_min is not null and five_s_min is not null
    and pause_min >= 0 and meeting_min >= 0 and five_s_min >= 0
    and pause_min <= 1440 and meeting_min <= 1440 and five_s_min <= 1440
    and abs(opening_min - (shift_duration_min - pause_min - meeting_min - five_s_min)) < 0.000001
  )
);
commit;
notify pgrst, 'reload schema';
