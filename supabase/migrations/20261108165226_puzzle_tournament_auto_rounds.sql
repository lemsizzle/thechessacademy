-- A short preparation lease prevents every open lobby from generating a deck.
-- All progression remains on authenticated requests; no per-move polling added.
alter table public.puzzle_battle_tournaments
  add column round_starts_at bigint,
  add column advance_token uuid,
  add column advance_until timestamptz;

alter function public.puzzle_tournament_snapshot(uuid,boolean,uuid) rename to puzzle_tournament_snapshot_base;
create function public.puzzle_tournament_snapshot(p_id uuid,p_teacher boolean default false,p_student_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare snapshot jsonb;
begin
  snapshot:=public.puzzle_tournament_snapshot_base(p_id,p_teacher,p_student_id);
  return snapshot||jsonb_build_object('roundStartsAt',(select round_starts_at from public.puzzle_battle_tournaments where id=p_id));
end $$;

alter function public.start_puzzle_tournament_round(uuid,integer,jsonb,jsonb) rename to start_puzzle_tournament_round_base;
create function public.start_puzzle_tournament_round(p_id uuid,p_version integer,p_pairs jsonb,p_deck jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare started bigint:=floor(extract(epoch from clock_timestamp())*1000)+10000;
begin
  perform public.start_puzzle_tournament_round_base(p_id,p_version,p_pairs,p_deck);
  update public.puzzle_battle_tournaments t set round_starts_at=coalesce((
    select (b.state->>'startsAt')::bigint from public.puzzle_tournament_matches m
    join public.puzzle_battles b on b.id=m.battle_id
    where m.tournament_id=p_id and m.round=t.round limit 1
  ),started),advance_token=null,advance_until=null where t.id=p_id;
end $$;

create function public.claim_puzzle_tournament_round(p_id uuid,p_version integer,p_token uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare t public.puzzle_battle_tournaments;
begin
  select * into t from public.puzzle_battle_tournaments where id=p_id for update;
  if t.id is null or t.status<>'active' or t.round<1 or t.round>=t.rounds or t.version<>p_version
    or t.advance_until>clock_timestamp()
    or exists(select 1 from public.puzzle_tournament_matches where tournament_id=p_id and result is null)
  then return false; end if;
  update public.puzzle_battle_tournaments set advance_token=p_token,advance_until=clock_timestamp()+interval '30 seconds' where id=p_id;
  return true;
end $$;

create function public.release_puzzle_tournament_round(p_id uuid,p_token uuid)
returns void language sql security invoker set search_path='' as $$
  update public.puzzle_battle_tournaments set advance_token=null,advance_until=null where id=p_id and advance_token=p_token;
$$;

revoke all on function public.puzzle_tournament_snapshot(uuid,boolean,uuid),public.start_puzzle_tournament_round(uuid,integer,jsonb,jsonb),public.claim_puzzle_tournament_round(uuid,integer,uuid),public.release_puzzle_tournament_round(uuid,uuid) from public,anon,authenticated;
grant execute on function public.puzzle_tournament_snapshot(uuid,boolean,uuid),public.start_puzzle_tournament_round(uuid,integer,jsonb,jsonb),public.claim_puzzle_tournament_round(uuid,integer,uuid),public.release_puzzle_tournament_round(uuid,uuid) to service_role;
