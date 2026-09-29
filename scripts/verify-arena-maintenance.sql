-- Read the installed predicate, but exercise it only against temporary fixtures.
-- Safe on a linked database: no application rows or real HTTP calls are changed.
begin;
create temporary table maintenance_test_arenas (
  id uuid primary key, status text, experience_version integer,
  starts_at timestamptz, ends_at timestamptz
);
create temporary table maintenance_test_results (tournament_id uuid primary key);
do $$
declare definition text;
begin
  definition := pg_get_functiondef('public.arena_maintenance_needed()'::regprocedure);
  definition := replace(definition, 'public.arena_maintenance_needed()', 'pg_temp.arena_maintenance_needed()');
  definition := replace(definition, 'public.internal_arena_tournaments', 'pg_temp.maintenance_test_arenas');
  definition := replace(definition, 'public.internal_arena_results', 'pg_temp.maintenance_test_results');
  execute definition;
end;
$$;
do $$
declare fixture record;
begin
  if pg_temp.arena_maintenance_needed() then raise exception 'Empty database must be idle'; end if;
  for fixture in select * from (values
    ('future scheduled', 'scheduled', 1, interval '1 hour', interval '2 hours', false, false),
    ('scheduled start boundary', 'scheduled', 1, interval '0', interval '1 hour', false, true),
    ('missed whole scheduled window', 'scheduled', 1, interval '-2 hours', interval '-1 hour', false, true),
    ('legacy scheduled start', 'scheduled', 0, interval '-1 minute', interval '1 hour', false, true),
    ('active game recovery', 'active', 1, interval '-1 minute', interval '1 hour', false, true),
    ('active end boundary', 'active', 1, interval '-1 hour', interval '0', false, true),
    ('legacy end boundary', 'active', 0, interval '-1 hour', interval '0', false, true),
    ('legacy active has no v1 recovery', 'active', 0, interval '-1 hour', interval '1 hour', false, false),
    ('finished prize retry', 'finished', 1, interval '-2 hours', interval '-1 hour', false, true),
    ('completed settlement', 'finished', 1, interval '-2 hours', interval '-1 hour', true, false),
    ('legacy finished', 'finished', 0, interval '-2 hours', interval '-1 hour', false, false),
    ('cancelled tournament', 'cancelled', 1, interval '-2 hours', interval '-1 hour', false, false),
    ('rescheduled to future', 'scheduled', 1, interval '1 hour', interval '2 hours', true, false),
    ('reopened active with old results', 'active', 1, interval '-1 hour', interval '0', true, true)
  ) as cases(label,status,experience_version,start_offset,end_offset,settled,expected) loop
    truncate pg_temp.maintenance_test_arenas, pg_temp.maintenance_test_results;
    insert into pg_temp.maintenance_test_arenas values
      ('00000000-0000-4000-8000-000000000001',fixture.status,fixture.experience_version,
       now()+fixture.start_offset,now()+fixture.end_offset);
    if fixture.settled then
      insert into pg_temp.maintenance_test_results values ('00000000-0000-4000-8000-000000000001');
    end if;
    if pg_temp.arena_maintenance_needed() is distinct from fixture.expected then
      raise exception 'Maintenance predicate failed: %', fixture.label;
    end if;
  end loop;
end;
$$;
select 'Passed: empty database and 14 tournament lifecycle cases' as verification;
rollback;
