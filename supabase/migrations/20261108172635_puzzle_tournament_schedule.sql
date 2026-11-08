alter table public.puzzle_battle_tournaments add column starts_at timestamptz;

-- Keep the existing manual-create RPC for backwards compatibility.
create function public.create_scheduled_puzzle_tournament(p_id uuid,p_title text,p_mode text,p_duration integer,p_rounds integer,p_starts_at timestamptz default null)
returns uuid language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.puzzle_battle_tournaments where id=p_id) then return p_id; end if;
  if p_starts_at<=clock_timestamp() then raise exception 'Choose a start time in the future.'; end if;
  insert into public.puzzle_battle_tournaments(id,title,mode,duration,rounds,starts_at)
  values(p_id,p_title,p_mode,p_duration,p_rounds,p_starts_at) on conflict(id) do nothing;
  return p_id;
end $$;

create function public.set_puzzle_tournament_schedule(p_id uuid,p_version integer,p_starts_at timestamptz)
returns void language plpgsql security invoker set search_path='' as $$
declare t public.puzzle_battle_tournaments;
begin
  select * into t from public.puzzle_battle_tournaments where id=p_id for update;
  if t.id is null then raise exception 'Tournament not found.'; end if;
  if t.status<>'waiting' or t.round<>0 then raise exception 'The tournament has already started. Its start time cannot be changed.'; end if;
  if t.version<>p_version then raise exception 'The tournament changed. Refresh before saving the schedule.'; end if;
  if p_starts_at<=clock_timestamp() then raise exception 'Choose a start time in the future.'; end if;
  update public.puzzle_battle_tournaments set starts_at=p_starts_at,version=version+1,advance_token=null,advance_until=null where id=p_id;
end $$;

create or replace function public.puzzle_tournament_snapshot(p_id uuid,p_teacher boolean default false,p_student_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare snapshot jsonb;
begin
  snapshot:=public.puzzle_tournament_snapshot_base(p_id,p_teacher,p_student_id);
  return snapshot||(select jsonb_build_object('roundStartsAt',round_starts_at,'startsAt',starts_at) from public.puzzle_battle_tournaments where id=p_id);
end $$;

create or replace function public.claim_puzzle_tournament_round(p_id uuid,p_version integer,p_token uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare t public.puzzle_battle_tournaments;
begin
  select * into t from public.puzzle_battle_tournaments where id=p_id for update;
  if t.id is null or t.version<>p_version or t.advance_until>clock_timestamp() then return false; end if;
  if t.status='waiting' and t.round=0 then
    if t.starts_at is null or t.starts_at>clock_timestamp()
      or (select count(*) from public.puzzle_tournament_entries where tournament_id=p_id)<2 then return false; end if;
  elsif t.status='active' and t.round>=1 and t.round<t.rounds then
    if exists(select 1 from public.puzzle_tournament_matches where tournament_id=p_id and result is null) then return false; end if;
  else return false;
  end if;
  update public.puzzle_battle_tournaments set advance_token=p_token,advance_until=clock_timestamp()+interval '30 seconds' where id=p_id;
  return true;
end $$;

create or replace function public.list_puzzle_tournaments() returns jsonb language sql security invoker set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb) from (
    select t.id,t.title,t.mode,t.duration,t.rounds,t.round,t.status,t.created_at,t.starts_at as "startsAt",
      (select count(*) from public.puzzle_tournament_entries e where e.tournament_id=t.id) as players
    from public.puzzle_battle_tournaments t order by t.created_at desc limit 30
  ) t;
$$;

revoke all on function public.create_scheduled_puzzle_tournament(uuid,text,text,integer,integer,timestamptz),public.set_puzzle_tournament_schedule(uuid,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.create_scheduled_puzzle_tournament(uuid,text,text,integer,integer,timestamptz),public.set_puzzle_tournament_schedule(uuid,integer,timestamptz) to service_role;
