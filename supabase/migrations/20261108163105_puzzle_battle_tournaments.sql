-- Teacher-hosted rounds use the existing battle engine. All access goes through
-- authenticated application routes; answers and bot plans are service-only.
create table public.puzzle_battle_tournaments (
  id uuid primary key, title text not null check(length(title) between 1 and 80),
  mode text not null check(mode in ('survival','star-wars','hide-and-seek')),
  duration integer not null check(duration in (60,180,300,600)),
  rounds integer not null check(rounds between 1 and 9),
  round integer not null default 0, version integer not null default 0,
  status text not null default 'waiting' check(status in ('waiting','active','finished','cancelled')),
  created_at timestamptz not null default now()
);
create table public.puzzle_tournament_entries (
  id uuid primary key, tournament_id uuid not null references public.puzzle_battle_tournaments(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  name text not null check(length(name) between 1 and 60),
  elo integer check(elo between 200 and 2400),
  check ((student_id is null) <> (elo is null)),
  unique(tournament_id,student_id), unique(tournament_id,id)
);
create index puzzle_tournament_entries_student_idx on public.puzzle_tournament_entries(student_id) where student_id is not null;
create table public.puzzle_tournament_matches (
  id uuid primary key, tournament_id uuid not null references public.puzzle_battle_tournaments(id) on delete cascade,
  round integer not null check(round between 1 and 9),
  a_id uuid not null, b_id uuid,
  battle_id uuid unique references public.puzzle_battles(id) on delete set null,
  finishes_at timestamptz, bot_result jsonb, result jsonb,
  foreign key(tournament_id,a_id) references public.puzzle_tournament_entries(tournament_id,id) on delete cascade,
  foreign key(tournament_id,b_id) references public.puzzle_tournament_entries(tournament_id,id) on delete cascade,
  check(a_id is distinct from b_id), unique(tournament_id,round,a_id)
);
create index puzzle_tournament_matches_b_idx on public.puzzle_tournament_matches(tournament_id,b_id);
create index puzzle_tournaments_recent_idx on public.puzzle_battle_tournaments(created_at desc);
alter table public.puzzle_battle_tournaments enable row level security;
alter table public.puzzle_tournament_entries enable row level security;
alter table public.puzzle_tournament_matches enable row level security;
revoke all on public.puzzle_battle_tournaments,public.puzzle_tournament_entries,public.puzzle_tournament_matches from public,anon,authenticated;
grant select,insert,update,delete on public.puzzle_battle_tournaments,public.puzzle_tournament_entries,public.puzzle_tournament_matches to service_role;

create function public.create_puzzle_tournament(p_id uuid,p_title text,p_mode text,p_duration integer,p_rounds integer)
returns uuid language plpgsql security invoker set search_path='' as $$
begin
  insert into public.puzzle_battle_tournaments(id,title,mode,duration,rounds)
  values(p_id,p_title,p_mode,p_duration,p_rounds) on conflict(id) do nothing;
  return p_id;
end $$;

create function public.edit_puzzle_tournament_entry(p_id uuid,p_action text,p_entry jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare t public.puzzle_battle_tournaments; sid uuid:=(p_entry->>'studentId')::uuid;
begin
  select * into t from public.puzzle_battle_tournaments where id=p_id for update;
  if t.id is null then raise exception 'Tournament not found.'; end if;
  if t.status<>'waiting' then raise exception 'The roster is locked after the tournament starts.'; end if;
  if p_action='join' then
    if not exists(select 1 from public.students where id=sid and is_active=true) then raise exception 'Active student required.'; end if;
    if exists(select 1 from public.puzzle_tournament_entries where tournament_id=p_id and student_id=sid) then return; end if;
  end if;
  if p_action in ('join','bot') then
    if p_action='bot' and exists(select 1 from public.puzzle_tournament_entries where tournament_id=p_id and id=(p_entry->>'id')::uuid) then return; end if;
    if (select count(*) from public.puzzle_tournament_entries where tournament_id=p_id)>=32 then raise exception 'This tournament is full (32 players).'; end if;
    insert into public.puzzle_tournament_entries(id,tournament_id,student_id,name,elo)
    values((p_entry->>'id')::uuid,p_id,case when p_action='join' then sid end,p_entry->>'name',case when p_action='bot' then (p_entry->>'elo')::integer end)
    on conflict(id) do nothing;
  elsif p_action='leave' then
    delete from public.puzzle_tournament_entries where tournament_id=p_id and student_id=sid;
  elsif p_action='remove' then
    delete from public.puzzle_tournament_entries where tournament_id=p_id and id=(p_entry->>'id')::uuid;
  elsif p_action='rating' then
    update public.puzzle_tournament_entries set elo=(p_entry->>'elo')::integer
    where tournament_id=p_id and id=(p_entry->>'id')::uuid and student_id is null;
  else raise exception 'Unknown roster action.';
  end if;
  update public.puzzle_battle_tournaments set version=version+1 where id=p_id;
end $$;

-- Settle using database time even if a participant closes their tab. No polling
-- of puzzle decks, no background engine, and no bot plans in the response.
create function public.puzzle_tournament_snapshot(p_id uuid,p_teacher boolean default false,p_student_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.puzzle_battle_tournaments; m public.puzzle_tournament_matches; b public.puzzle_battles;
  st jsonb; a jsonb; z jsonb; winner text; result_value jsonb; ms numeric:=floor(extract(epoch from clock_timestamp())*1000);
begin
  select * into t from public.puzzle_battle_tournaments where id=p_id for update;
  if t.id is null then raise exception 'Tournament not found.'; end if;
  if t.status='active' then
    for m in select * from public.puzzle_tournament_matches where tournament_id=p_id and result is null order by battle_id loop
      result_value:=null;
      if m.battle_id is null then
        if m.finishes_at<=clock_timestamp() then result_value:=m.bot_result; end if;
      else
        select * into b from public.puzzle_battles where id=m.battle_id;
        if b.state?'bot' and b.state->>'status'='playing' then
          perform public.advance_puzzle_battle_bot(b.id);
        end if;
        select * into b from public.puzzle_battles where id=m.battle_id for update;
        st:=b.state; a:=st#>'{players,0}'; z:=st#>'{players,1}';
        if st->>'status'='playing' and ms>=(st->>'endsAt')::numeric then
          winner:=case when (a->>'forfeited')::boolean then z->>'id' when (z->>'forfeited')::boolean then a->>'id'
            when (a->>'score')::integer=(z->>'score')::integer then null when (a->>'score')::integer>(z->>'score')::integer then a->>'id' else z->>'id' end;
          st:=st||jsonb_build_object('status','finished','winnerId',winner);
          update public.puzzle_battles set state=st,version=version+1 where id=b.id;
        end if;
        if st->>'status' in ('finished','cancelled') then
          result_value:=jsonb_build_object('winnerEntryId',case when st->>'winnerId'=a->>'id' then m.a_id when st->>'winnerId'=z->>'id' then m.b_id else null end,
            'scoreA',(a->>'score')::integer,'scoreB',(z->>'score')::integer,'reason',case when st->>'status'='cancelled' then 'cancelled' else 'played' end);
        end if;
      end if;
      if result_value is not null then update public.puzzle_tournament_matches set result=result_value where id=m.id; end if;
    end loop;
    if t.round>=t.rounds and not exists(select 1 from public.puzzle_tournament_matches where tournament_id=p_id and result is null) then
      update public.puzzle_battle_tournaments set status='finished',version=version+1 where id=p_id returning * into t;
    end if;
  end if;
  return jsonb_build_object('id',t.id,'title',t.title,'mode',t.mode,'duration',t.duration,'rounds',t.rounds,'round',t.round,'status',t.status,'version',t.version,'createdAt',t.created_at,
    'me',(select id from public.puzzle_tournament_entries where tournament_id=p_id and student_id=p_student_id),
    'entries',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'studentId',case when p_teacher then e.student_id else null end)
      ||case when p_teacher then jsonb_build_object('elo',e.elo) else '{}'::jsonb end order by e.id) from public.puzzle_tournament_entries e where e.tournament_id=p_id),'[]'::jsonb),
    'matches',coalesce((select jsonb_agg(jsonb_build_object('id',mx.id,'round',mx.round,'a',mx.a_id,'b',mx.b_id,'battleId',case when p_teacher or p_student_id in (lb.host_id,lb.guest_id) then mx.battle_id else null end,
      'result',mx.result,'scoreA',coalesce((mx.result->>'scoreA')::integer,(lb.state#>>'{players,0,score}')::integer,0),
      'scoreB',coalesce((mx.result->>'scoreB')::integer,(lb.state#>>'{players,1,score}')::integer,0)) order by mx.round,mx.id)
      from public.puzzle_tournament_matches mx left join public.puzzle_battles lb on lb.id=mx.battle_id where mx.tournament_id=p_id),'[]'::jsonb));
end $$;

create function public.start_puzzle_tournament_round(p_id uuid,p_version integer,p_pairs jsonb,p_deck jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare t public.puzzle_battle_tournaments; e public.puzzle_tournament_entries; a public.puzzle_tournament_entries; z public.puzzle_tournament_entries;
  pair jsonb; starts numeric; st jsonb; bid uuid; mid uuid; used uuid[]:='{}'; entrant_count integer;
begin
  select * into t from public.puzzle_battle_tournaments where id=p_id for update;
  if t.id is null then raise exception 'Tournament not found.'; end if;
  if t.version<>p_version then raise exception 'The tournament changed. Refresh before starting the round.'; end if;
  if t.status not in ('waiting','active') or t.round>=t.rounds then raise exception 'This tournament cannot start another round.'; end if;
  if exists(select 1 from public.puzzle_tournament_matches where tournament_id=p_id and result is null) then raise exception 'Wait for every battle in this round to finish.'; end if;
  select count(*) into entrant_count from public.puzzle_tournament_entries where tournament_id=p_id;
  if entrant_count<2 then raise exception 'At least two players are needed.'; end if;
  -- Same per-player lock used by casual battles; stable order prevents races
  -- between concurrent tournaments or a casual challenge and round creation.
  for e in select * from public.puzzle_tournament_entries where tournament_id=p_id and student_id is not null order by student_id loop
    perform pg_advisory_xact_lock(hashtextextended('puzzle-battle-player:'||e.student_id::text,0));
    if not exists(select 1 from public.students where id=e.student_id and is_active=true) then raise exception '% no longer has an active student profile.',e.name; end if;
    if exists(select 1 from public.puzzle_battles b where (b.host_id=e.student_id or b.guest_id=e.student_id) and
      ((b.state->>'status'='waiting' and b.expires_at>clock_timestamp()) or (b.state->>'status'='playing' and (b.state->>'endsAt')::numeric>extract(epoch from clock_timestamp())*1000))) then
      raise exception '% is still in another Puzzle Battle. Ask them to finish or leave it, then retry.',e.name;
    end if;
  end loop;
  if jsonb_array_length(p_deck) not between 1 and 100 then raise exception 'Missing round puzzles.'; end if;
  starts:=floor(extract(epoch from clock_timestamp())*1000)+10000;
  for pair in select value from jsonb_array_elements(p_pairs) loop
    select * into a from public.puzzle_tournament_entries where tournament_id=p_id and id=(pair->>'a')::uuid;
    select * into z from public.puzzle_tournament_entries where tournament_id=p_id and id=(pair->>'b')::uuid;
    if a.id is null or a.id=any(used) or (pair->>'b' is not null and (z.id is null or z.id=a.id or z.id=any(used))) then raise exception 'Invalid round pairings.'; end if;
    used:=array_append(used,a.id); if z.id is not null then used:=array_append(used,z.id); end if;
    mid:=gen_random_uuid(); bid:=null;
    if z.id is null then
      insert into public.puzzle_tournament_matches(id,tournament_id,round,a_id,result)
      values(mid,p_id,t.round+1,a.id,jsonb_build_object('winnerEntryId',a.id,'scoreA',0,'scoreB',0,'reason','bye'));
    elsif a.student_id is null and z.student_id is null then
      insert into public.puzzle_tournament_matches(id,tournament_id,round,a_id,b_id,finishes_at,bot_result)
      values(mid,p_id,t.round+1,a.id,z.id,to_timestamp((starts+(pair->>'afterMs')::numeric)/1000),pair->'result');
    else
      if a.student_id is null then raise exception 'Invalid player order.'; end if;
      bid:=gen_random_uuid();
      st:=pair->'state'||jsonb_build_object('status','playing','startsAt',starts,'endsAt',starts+t.duration*1000,'winnerId',null,
        'tournament',jsonb_build_object('id',p_id,'round',t.round+1,'title',t.title));
      if st#>>'{players,0,id}' is distinct from a.student_id::text or jsonb_array_length(st->'players')<>2 then raise exception 'Invalid battle players.'; end if;
      if z.student_id is not null and st#>>'{players,1,id}' is distinct from z.student_id::text then raise exception 'Invalid opponent.'; end if;
      if z.student_id is null then
        if st#>>'{players,1,id}' is distinct from 'bot:steady' or jsonb_array_length(pair->'plan')<>jsonb_array_length(p_deck) then raise exception 'Invalid bot plan.'; end if;
        st:=st||jsonb_build_object('bot',jsonb_build_object('level','steady','nextAt',starts+(pair#>>'{plan,0,atMs}')::numeric));
      end if;
      insert into public.puzzle_battles(id,code,host_id,guest_id,mode,duration,state,expires_at)
      values(bid,upper(substr(replace(bid::text,'-',''),1,8)),a.student_id,z.student_id,t.mode,t.duration,st,to_timestamp((starts+t.duration*1000)/1000));
      insert into public.puzzle_battle_decks(battle_id,challenges,bot_plan) values(bid,p_deck,pair->'plan');
      insert into public.puzzle_tournament_matches(id,tournament_id,round,a_id,b_id,battle_id) values(mid,p_id,t.round+1,a.id,z.id,bid);
    end if;
  end loop;
  if cardinality(used)<>entrant_count then raise exception 'Every player must be paired exactly once.'; end if;
  update public.puzzle_battle_tournaments set round=round+1,status='active',version=version+1 where id=p_id;
end $$;

create function public.cancel_puzzle_tournament(p_id uuid) returns void language plpgsql security invoker set search_path='' as $$
declare t public.puzzle_battle_tournaments;
begin
  perform public.puzzle_tournament_snapshot(p_id,true,null);
  select * into t from public.puzzle_battle_tournaments where id=p_id for update;
  if t.id is null then raise exception 'Tournament not found.'; end if;
  if t.status in ('finished','cancelled') then return; end if;
  update public.puzzle_battles set state=state||jsonb_build_object('status','cancelled','winnerId',null),version=version+1
  where id in(select battle_id from public.puzzle_tournament_matches where tournament_id=p_id and result is null) and state->>'status'='playing';
  update public.puzzle_tournament_matches set result=jsonb_build_object('winnerEntryId',null,'scoreA',0,'scoreB',0,'reason','cancelled') where tournament_id=p_id and result is null;
  update public.puzzle_battle_tournaments set status='cancelled',version=version+1 where id=p_id;
end $$;

create function public.list_puzzle_tournaments() returns jsonb language sql security invoker set search_path='' as $$
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb) from (
    select t.id,t.title,t.mode,t.duration,t.rounds,t.round,t.status,t.created_at,
      (select count(*) from public.puzzle_tournament_entries e where e.tournament_id=t.id) as players
    from public.puzzle_battle_tournaments t order by t.created_at desc limit 30
  ) t;
$$;
revoke all on function public.create_puzzle_tournament(uuid,text,text,integer,integer),public.edit_puzzle_tournament_entry(uuid,text,jsonb),public.puzzle_tournament_snapshot(uuid,boolean,uuid),public.start_puzzle_tournament_round(uuid,integer,jsonb,jsonb),public.cancel_puzzle_tournament(uuid),public.list_puzzle_tournaments() from public,anon,authenticated;
grant execute on function public.create_puzzle_tournament(uuid,text,text,integer,integer),public.edit_puzzle_tournament_entry(uuid,text,jsonb),public.puzzle_tournament_snapshot(uuid,boolean,uuid),public.start_puzzle_tournament_round(uuid,integer,jsonb,jsonb),public.cancel_puzzle_tournament(uuid),public.list_puzzle_tournaments() to service_role;
