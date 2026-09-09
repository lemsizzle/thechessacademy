-- Exact placing awards, existing finalized results included, no extra XP/coins.
insert into public.badges(id,name,description,category,tier,xp_value,unlock_requirement,visual_theme,generation_status)
values
('a8e9a000-0000-4000-8000-000000000003','Arena Legends: Bronze Contender','Claim the bronze podium in an academy arena.','Tournament','C',0,'Finish 3rd in an in-app tournament.','Arena Legends shonen chess trophy','pending'),
('a8e9a000-0000-4000-8000-000000000002','Arena Legends: Silver Challenger','Rise to the silver podium in an academy arena.','Tournament','B',0,'Finish 2nd in an in-app tournament.','Arena Legends shonen chess trophy','pending'),
('a8e9a000-0000-4000-8000-000000000001','Arena Legends: Golden Champion','Conquer an academy arena and claim its golden crown.','Tournament','A',0,'Finish 1st in an in-app tournament.','Arena Legends shonen chess trophy','pending'),
('a8e9a000-0000-4000-8000-000000000005','Arena Legends: Platinum Dynasty','Build a dynasty with five academy arena victories.','Tournament','S',0,'Win 5 distinct in-app tournaments.','Arena Legends shonen chess trophy','pending')
on conflict(id) do nothing;

create or replace function public.award_arena_legends(p_student_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare r record; awarded uuid; placements integer[]; win_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('arena-legends:'||p_student_id::text,0));
  if not exists(select 1 from public.students where id=p_student_id) then return; end if;
  select array_agg(distinct (s.value->>'rank')::integer),
    count(distinct result.tournament_id) filter(where (s.value->>'rank')::integer=1)::integer
  into placements,win_count
  from public.internal_arena_results result
  join public.internal_arena_tournaments t on t.id=result.tournament_id
  cross join lateral jsonb_array_elements(result.standings) s(value)
  where t.status='finished' and t.experience_version=1
    and s.value->>'studentId'=p_student_id::text
    and (s.value->>'gamesPlayed')::integer>0;
  for r in
    select * from (values
      ('a8e9a000-0000-4000-8000-000000000003'::uuid,3=any(placements),'Finished 3rd in an in-app arena.'),
      ('a8e9a000-0000-4000-8000-000000000002'::uuid,2=any(placements),'Finished 2nd in an in-app arena.'),
      ('a8e9a000-0000-4000-8000-000000000001'::uuid,1=any(placements),'Finished 1st in an in-app arena.'),
      ('a8e9a000-0000-4000-8000-000000000005'::uuid,win_count>=5,'Won at least 5 distinct in-app arenas.')
    ) rules(badge_id,eligible,note) where eligible
  loop
    awarded:=null;
    insert into public.student_badges(student_id,badge_id,note)
    values(p_student_id,r.badge_id,r.note)
    on conflict(student_id,badge_id) do nothing returning id into awarded;
    if awarded is not null then
      insert into public.activity_events(student_id,event_type,title,description)
      select p_student_id,'badge_earned',b.name,r.note from public.badges b where b.id=r.badge_id;
    end if;
  end loop;
end;
$$;
revoke all on function public.award_arena_legends(uuid) from public,anon,authenticated;
grant execute on function public.award_arena_legends(uuid) to service_role;

create or replace function public.arena_legends_on_result() returns trigger
language plpgsql security invoker set search_path='' as $$
declare entrant record;
begin
  -- The existing settlement inserts once, after all games finish. Stable ordering
  -- serializes per-student awards across concurrent tournament settlements.
  for entrant in select distinct s.id from jsonb_array_elements(new.standings) p
    join public.students s on s.id::text=p->>'studentId' order by s.id
  loop perform public.award_arena_legends(entrant.id); end loop;
  return new;
end;
$$;
revoke all on function public.arena_legends_on_result() from public,anon,authenticated;
grant execute on function public.arena_legends_on_result() to service_role;
drop trigger if exists arena_legends_result_insert on public.internal_arena_results;
create trigger arena_legends_result_insert after insert on public.internal_arena_results
for each row execute function public.arena_legends_on_result();

-- Requested historical recognition; replay-safe and does not create results.
do $$ declare entrant record; begin
  for entrant in select distinct s.id from public.internal_arena_results r
    cross join lateral jsonb_array_elements(r.standings) p
    join public.students s on s.id::text=p->>'studentId' order by s.id
  loop perform public.award_arena_legends(entrant.id); end loop;
end $$;
