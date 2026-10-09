-- QOS / TRS Injection — à exécuter dans le SQL Editor de Supabase.
-- Tous les utilisateurs autorisés partagent le même atelier.
begin;
create table if not exists public.workshop_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'operator' check (role in ('admin','operator','viewer'))
);
create or replace function public.workshop_role() returns text
language sql stable security definer set search_path = ''
as $$ select role from public.workshop_members where user_id = auth.uid() $$;
revoke all on function public.workshop_role() from public;
grant execute on function public.workshop_role() to authenticated;

create table if not exists public.presses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 80),
  active boolean not null default true
);
create unique index if not exists presses_name_ci on public.presses(lower(name));
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (length(trim(code)) between 1 and 80),
  name text not null check (length(trim(name)) between 1 and 160),
  cavities integer not null check(cavities>0),
  mold_cycle_seconds numeric not null check(mold_cycle_seconds>0),
  standard_seconds numeric not null check(standard_seconds>0),
  active boolean not null default true
);
create unique index if not exists articles_code_ci on public.articles(lower(code));
create table if not exists public.production_records (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  shift text not null check(shift in ('Matin','Après-Midi','Nuit')),
  press_id uuid not null references public.presses(id),
  article_id uuid not null references public.articles(id),
  opening_min numeric not null check(opening_min>0 and opening_min<=1440),
  planned_min numeric not null default 0 check(planned_min>=0),
  breakdown_min numeric not null default 0 check(breakdown_min>=0),
  startup_min numeric not null default 0 check(startup_min>=0),
  changeover_min numeric not null default 0 check(changeover_min>=0),
  good_qty integer not null default 0 check(good_qty>=0),
  startup_rejects integer not null default 0 check(startup_rejects>=0),
  production_rejects integer not null default 0 check(production_rejects>=0),
  labor_hours numeric not null default 0 check(labor_hours>=0),
  cycle_seconds numeric not null check(cycle_seconds>0),
  standard_seconds numeric not null check(standard_seconds>0),
  notes text not null default '' check(length(notes)<=4000),
  source text not null default 'web' check(source in ('web','excel')),
  source_row integer,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(date,shift,press_id,article_id),
  check(planned_min+breakdown_min+startup_min+changeover_min<=opening_min),
  check(opening_min-planned_min-breakdown_min-startup_min-changeover_min>0 or good_qty+startup_rejects+production_rejects=0)
);
create index if not exists production_records_date on public.production_records(date);

create or replace function public.prepare_production_record() returns trigger
language plpgsql set search_path = '' as $$
declare a public.articles; p_active boolean;
begin
  if TG_OP='INSERT' then
    select * into a from public.articles where id=new.article_id;
    select active into p_active from public.presses where id=new.press_id;
    if a.active is not true or p_active is not true then raise exception 'Presse ou article inactif'; end if;
    new.cycle_seconds := a.mold_cycle_seconds/a.cavities;
    new.standard_seconds := a.standard_seconds;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    if new.article_id <> old.article_id then
      select * into a from public.articles where id=new.article_id;
      if a.active is not true then raise exception 'Article inactif'; end if;
      new.cycle_seconds := a.mold_cycle_seconds/a.cavities;
      new.standard_seconds := a.standard_seconds;
    else
      new.cycle_seconds := old.cycle_seconds;
      new.standard_seconds := old.standard_seconds;
    end if;
    if new.press_id <> old.press_id then
      select active into p_active from public.presses where id=new.press_id;
      if p_active is not true then raise exception 'Presse inactive'; end if;
    end if;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists prepare_production_record on public.production_records;
create trigger prepare_production_record before insert or update on public.production_records for each row execute function public.prepare_production_record();

-- Les ratios restent NULL lorsque leur dénominateur est nul.
-- Les cycles et standards sont des instantanés historiques, non rétroactifs.
create or replace view public.production_metrics with (security_invoker=true) as
with base as (
  select r.id,r.date,r.shift,r.press_id,r.article_id,r.opening_min,r.planned_min,
    r.breakdown_min,r.startup_min,r.changeover_min,r.good_qty,r.startup_rejects,
    r.production_rejects,r.labor_hours,r.cycle_seconds,r.standard_seconds,r.notes,
    r.source,r.source_row,r.created_by,r.created_at,r.updated_at,
    opening_min-planned_min as required_min,
    opening_min-planned_min-breakdown_min-startup_min-changeover_min as runtime_min,
    good_qty+startup_rejects+production_rejects as total_qty,
    good_qty*standard_seconds/3600 as earned_hours
  from public.production_records r
)
select base.*,
  runtime_min/nullif(required_min,0) as availability,
  total_qty*cycle_seconds/nullif(runtime_min*60,0) as performance,
  good_qty::numeric/nullif(total_qty,0) as quality,
  good_qty*cycle_seconds/nullif(required_min*60,0) as trs,
  earned_hours/nullif(labor_hours,0) as dle
from base;

alter table public.workshop_members enable row level security;
alter table public.presses enable row level security;
alter table public.articles enable row level security;
alter table public.production_records enable row level security;

drop policy if exists member_self_read on public.workshop_members;
create policy member_self_read on public.workshop_members for select to authenticated using(user_id=auth.uid());
-- Les membres se gèrent uniquement depuis le SQL Editor par le propriétaire.
do $$ declare t text; begin
  foreach t in array array['presses','articles','production_records'] loop
    execute format('drop policy if exists member_read on public.%I',t);
    execute format('create policy member_read on public.%I for select to authenticated using (public.workshop_role() is not null)',t);
    execute format('drop policy if exists writer_insert on public.%I',t);
    execute format('drop policy if exists writer_update on public.%I',t);
    if t='production_records' then
      execute format('create policy writer_insert on public.%I for insert to authenticated with check (public.workshop_role() in (''admin'',''operator'') and created_by=auth.uid())',t);
      execute format('create policy writer_update on public.%I for update to authenticated using (public.workshop_role() in (''admin'',''operator'')) with check (public.workshop_role() in (''admin'',''operator''))',t);
    else
      execute format('create policy writer_insert on public.%I for insert to authenticated with check (public.workshop_role()=''admin'')',t);
      execute format('create policy writer_update on public.%I for update to authenticated using (public.workshop_role()=''admin'') with check (public.workshop_role()=''admin'')',t);
    end if;
  end loop;
end $$;
revoke all on public.workshop_members,public.presses,public.articles,public.production_records,public.production_metrics from anon;
grant select on public.workshop_members to authenticated;
grant select,insert,update on public.presses,public.articles,public.production_records to authenticated;
grant select on public.production_metrics to authenticated;
commit;

-- Après avoir créé un utilisateur dans Authentication > Users, autoriser son email :
-- insert into public.workshop_members(user_id,role)
-- select id,'admin' from auth.users where email='votre@email.fr'
-- on conflict(user_id) do update set role=excluded.role;
