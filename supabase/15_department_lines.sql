-- Optional cloud update after migrations 01–14: production history and IDs stay intact.
begin;
insert into public.presses(id, name, active, department) values
('70000000-0000-4000-8000-200000000001', 'Ligne de peinture', true, 'metallization'),
('70000000-0000-4000-8000-200000000002', 'Ligne de support Bosage', true, 'metallization')
on conflict do nothing;
update public.presses set name = 'Ligne Décoration'
where department = 'screen-printing' and name = 'Ligne Sérigraphie'
and not exists (select 1 from public.presses where department = 'screen-printing' and lower(name) = lower('Ligne Décoration'));
commit;
