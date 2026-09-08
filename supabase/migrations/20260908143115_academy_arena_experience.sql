-- New/scheduled Arenas opt in; historical and already-running Arenas retain legacy policy.
alter table public.internal_arena_tournaments add column experience_version integer not null default 0;
alter table public.internal_arena_tournaments alter column experience_version set default 1;
update public.internal_arena_tournaments set experience_version=1 where status='scheduled' and starts_at>now();
alter table public.internal_arena_entries
  add column queue_entered_at timestamptz,
  add column last_seen_at timestamptz,
  add column queue_enabled boolean not null default true;
create index arena_ready_queue_idx on public.internal_arena_entries(tournament_id,queue_entered_at,id)
  where student_id is not null and status='waiting' and queue_enabled;

create table public.internal_arena_results (
  tournament_id uuid primary key references public.internal_arena_tournaments(id),
  standings jsonb not null,
  settled_at timestamptz not null default now()
);
alter table public.internal_arena_results enable row level security;
revoke all on public.internal_arena_results from public,anon,authenticated,service_role;
grant select,insert on public.internal_arena_results to service_role;

create function public.arena_entry_queue_timing() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.status='waiting' and not new.queue_enabled then new.status:='joined'; end if;
  if new.status='waiting' and (tg_op='INSERT' or old.status is distinct from 'waiting') then
    new.queue_entered_at:=now();
  end if;
  return new;
end;
$$;
create trigger arena_entry_queue_timing before insert or update on public.internal_arena_entries
for each row execute function public.arena_entry_queue_timing();

create function public.arena_student_ready(p_tournament_id uuid,p_student_id uuid) returns boolean
language sql volatile security invoker set search_path='' as $$
  select exists(select 1 from public.internal_arena_entries e
    join public.students s on s.id=e.student_id
    join public.internal_arena_tournaments t on t.id=e.tournament_id
    where e.tournament_id=p_tournament_id and e.student_id=p_student_id
      and e.status='waiting' and e.queue_enabled and e.current_game_id is null
      and e.last_seen_at >= clock_timestamp()-interval '20 seconds' and s.is_active
      and (t.class_group is null or t.class_group=s.class_group)
      and not exists(select 1 from public.live_chess_games g
        where g.status='active' and g.game_mode='live'
          and (g.white_player_id=s.id or g.black_player_id=s.id)));
$$;

create function public.arena_queue_presence(p_tournament_id uuid,p_student_id uuid,p_action text default 'heartbeat')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.internal_arena_tournaments%rowtype; e public.internal_arena_entries%rowtype;
begin
 select * into t from public.internal_arena_tournaments where id=p_tournament_id for update;
 if not found then raise exception 'Arena not found.'; end if;
 if p_action not in ('heartbeat','join','pause') then raise exception 'Invalid queue action.'; end if;
 if not exists(select 1 from public.students where id=p_student_id and is_active
   and (t.class_group is null or class_group=t.class_group)) then raise exception 'Student not eligible.'; end if;
 select * into e from public.internal_arena_entries where tournament_id=t.id and student_id=p_student_id for update;
 if p_action='join' and (t.status not in ('scheduled','active') or t.ends_at<=now()) then raise exception 'This Arena is closed.'; end if;
 if p_action='join' then
   insert into public.internal_arena_entries(tournament_id,student_id,status,queue_enabled,last_seen_at)
   values(t.id,p_student_id,case when t.starts_at<=now() then 'waiting' else 'joined' end,true,now())
   on conflict(tournament_id,student_id) do update set
     queue_enabled=true,last_seen_at=now(),
     queue_entered_at=case when internal_arena_entries.last_seen_at is null
       or internal_arena_entries.queue_entered_at is null
       or internal_arena_entries.last_seen_at < now()-interval '20 seconds'
       then now() else internal_arena_entries.queue_entered_at end,
     status=case when internal_arena_entries.status='playing' then 'playing'
       when t.starts_at<=now() then 'waiting' else 'joined' end;
 elsif e.id is not null then
   update public.internal_arena_entries set last_seen_at=now(),
     queue_entered_at=case when (e.last_seen_at is null or e.queue_entered_at is null or e.last_seen_at < now()-interval '20 seconds') and e.status='waiting' then now() else queue_entered_at end,
     queue_enabled=case when p_action='pause' then false else queue_enabled end,
     status=case when e.status='playing' then 'playing'
       when t.ends_at<=now() or t.status in ('finished','cancelled') then 'finished'
       when p_action='pause' then 'joined'
       when queue_enabled and t.starts_at<=now() and e.status in ('joined','waiting') then 'waiting'
       else status end
   where id=e.id;
 end if;
 select * into e from public.internal_arena_entries where tournament_id=t.id and student_id=p_student_id;
 return jsonb_build_object('status',case when e.status='playing' then 'matched' when e.status='waiting' then 'waiting' else 'joined' end,
   'gameId',e.current_game_id,'queueEnabled',e.queue_enabled,'queueEnteredAt',e.queue_entered_at);
end;
$$;
CREATE OR REPLACE FUNCTION public.match_internal_arena_student(p_tournament_id uuid, p_student_id uuid, p_challenge_code text, p_initial_fen text, p_avoid_student_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_tournament public.internal_arena_tournaments%rowtype;
  v_entry public.internal_arena_entries%rowtype;
  v_candidate public.internal_arena_entries%rowtype;
  v_game_id uuid;
  v_white_id uuid;
  v_black_id uuid;
  v_initial_ms bigint;
  v_now timestamptz := now();
begin
  select * into v_tournament
  from public.internal_arena_tournaments
  where id = p_tournament_id
  for update;

  if not found then raise exception 'Arena tournament not found.'; end if;
  if v_tournament.status = 'scheduled' and v_tournament.starts_at <= v_now and v_tournament.ends_at > v_now then
    update public.internal_arena_tournaments set status = 'active' where id = p_tournament_id;
    v_tournament.status := 'active';
  end if;
  if v_tournament.status <> 'active' or v_tournament.ends_at <= v_now then
    if v_tournament.status = 'active' and v_tournament.ends_at <= v_now then
      update public.internal_arena_tournaments set status = 'finished' where id = p_tournament_id;
    end if;
    raise exception 'This Arena is not accepting new games.';
  end if;
  if p_challenge_code !~ '^[A-Z0-9]{4}$' then raise exception 'Invalid challenge code.'; end if;

  select * into v_entry
  from public.internal_arena_entries
  where tournament_id = p_tournament_id and student_id = p_student_id
  for update;

  if not found or v_entry.status in ('withdrawn', 'finished') then
    raise exception 'Join this Arena before entering matchmaking.';
  end if;
  if v_entry.status = 'playing' and v_entry.current_game_id is not null then
    return jsonb_build_object('status', 'matched', 'gameId', v_entry.current_game_id);
  end if;
  if exists (
    select 1 from public.live_chess_games
    where game_mode = 'live'
      and status = 'active'
      and (white_player_id = p_student_id or black_player_id = p_student_id)
  ) then
    raise exception 'Finish your active live game before entering the Arena queue.';
  end if;

  if v_tournament.experience_version=1 and not public.arena_student_ready(p_tournament_id,p_student_id) then
    return jsonb_build_object('status','waiting','gameId',null);
  end if;
  update public.internal_arena_entries
  set status = 'waiting', current_game_id = null
  where id = v_entry.id;

  select candidate.* into v_candidate
  from public.internal_arena_entries candidate
  where candidate.tournament_id = p_tournament_id
    and candidate.student_id <> p_student_id
    and (p_avoid_student_id is null or candidate.student_id <> p_avoid_student_id)
    and public.arena_entries_can_pair(p_tournament_id, v_entry.id, candidate.id)
    and candidate.status = 'waiting'
    and (v_tournament.experience_version=0 or public.arena_student_ready(p_tournament_id,candidate.student_id))
    and candidate.current_game_id is null
    and not exists (
      select 1 from public.live_chess_games game
      where game.game_mode = 'live'
        and game.status = 'active'
        and (game.white_player_id = candidate.student_id or game.black_player_id = candidate.student_id)
    )
  order by case when v_tournament.experience_version=1 then candidate.queue_entered_at else candidate.updated_at end, candidate.joined_at, candidate.id
  for update skip locked
  limit 1;

  if not found then
    return jsonb_build_object('status', 'waiting', 'gameId', null);
  end if;

  if random() < 0.5 then
    v_white_id := p_student_id;
    v_black_id := v_candidate.student_id;
  else
    v_white_id := v_candidate.student_id;
    v_black_id := p_student_id;
  end if;
  v_initial_ms := nullif(v_tournament.time_control ->> 'initialMs', '')::bigint;

  insert into public.live_chess_games(
    challenge_code, created_by, white_player_id, black_player_id, status,
    time_control_id, time_control, initial_fen, current_fen, active_color,
    white_ms, black_ms, clock_started_at, started_at, rated, matchmaking,
    arena_tournament_id
  ) values (
    p_challenge_code, p_student_id, v_white_id, v_black_id, 'active',
    v_tournament.time_control_id, v_tournament.time_control, p_initial_fen, p_initial_fen, 'white',
    v_initial_ms, v_initial_ms, v_now, v_now, v_tournament.rated, true,
    p_tournament_id
  ) returning id into v_game_id;

  insert into public.internal_arena_pairings(
    tournament_id, game_id, white_student_id, black_student_id, started_at
  ) values (
    p_tournament_id, v_game_id, v_white_id, v_black_id, v_now
  );

  update public.internal_arena_entries
  set status = 'playing', current_game_id = v_game_id
  where id in (v_entry.id, v_candidate.id);

  return jsonb_build_object('status', 'matched', 'gameId', v_game_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.match_internal_arena_bot(p_tournament_id uuid, p_student_id uuid, p_challenge_code text, p_initial_fen text, p_bot_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 t public.internal_arena_tournaments%rowtype; e public.internal_arena_entries%rowtype; c public.internal_arena_entries%rowtype;
 b public.internal_arena_bots%rowtype; s public.students%rowtype; g uuid; w uuid; k uuid; color text; ms bigint;
begin
 select * into t from public.internal_arena_tournaments where id=p_tournament_id for update;
 if not found then raise exception 'Arena tournament not found.'; end if;
 if t.status='scheduled' and t.starts_at <= now() and t.ends_at > now() then
   update public.internal_arena_tournaments set status='active' where id=t.id; t.status:='active';
 end if;
 if t.status <> 'active' or t.ends_at <= now() then raise exception 'This Arena is not accepting new games.'; end if;
 if p_challenge_code is null or p_challenge_code !~ '^[A-Z0-9]{4}$' then raise exception 'Invalid challenge code.'; end if;
 if p_initial_fen is null or p_initial_fen <> 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' then raise exception 'Arena games must use the starting position.'; end if;
 select * into s from public.students where id=p_student_id and is_active for update;
 if not found or (t.class_group is not null and t.class_group is distinct from s.class_group) then raise exception 'Student is not eligible for this Arena.'; end if;
 select * into e from public.internal_arena_entries where tournament_id=t.id and student_id=p_student_id for update;
 if not found or e.status in ('withdrawn','finished') then raise exception 'Join this Arena before entering matchmaking.'; end if;
 if e.status='playing' then return jsonb_build_object('status','matched','gameId',e.current_game_id); end if;
 if exists(select 1 from public.live_chess_games where game_mode='live' and status='active' and (white_player_id=p_student_id or black_player_id=p_student_id)) then
   raise exception 'Finish your active live game before entering the Arena queue.';
 end if;
 if t.experience_version=1 then
   if not public.arena_student_ready(t.id,p_student_id) then return jsonb_build_object('status','waiting','gameId',null); end if;
   if p_bot_id is null and e.queue_entered_at>now()-interval '5 seconds' then
     return jsonb_build_object('status','waiting','gameId',null);
   end if;
   if exists(select 1 from public.internal_arena_entries h where h.tournament_id=t.id and h.student_id<>p_student_id
     and public.arena_student_ready(t.id,h.student_id) and public.arena_entries_can_pair(t.id,e.id,h.id)) then
     return jsonb_build_object('status','waiting','gameId',null);
   end if;
 end if;
 select candidate.* into c from public.internal_arena_entries candidate where tournament_id=t.id and bot_id is not null
   and status in ('waiting','joined') and current_game_id is null and (p_bot_id is null or bot_id=p_bot_id)
   and public.arena_entries_can_pair(t.id, e.id, candidate.id)
   order by updated_at,id for update skip locked limit 1;
 if not found then
   if p_bot_id is not null then raise exception 'This bot is unavailable or was your last opponent. Choose a different opponent.'; end if;
   return jsonb_build_object('status','waiting','gameId',null);
 end if;
 select * into b from public.internal_arena_bots where id=c.bot_id;
 color:=case when random()<0.5 then 'white' else 'black' end;
 w:=case when color='black' then p_student_id else null end;
 k:=case when color='white' then p_student_id else null end;
 ms:=(t.time_control->>'initialMs')::bigint;
 insert into public.live_chess_games(challenge_code,created_by,white_player_id,black_player_id,status,time_control_id,time_control,
   initial_fen,current_fen,active_color,white_ms,black_ms,clock_started_at,started_at,rated,matchmaking,arena_tournament_id,arena_bot)
 values(p_challenge_code,p_student_id,w,k,'active',t.time_control_id,t.time_control,p_initial_fen,p_initial_fen,'white',ms,ms,now(),now(),false,true,t.id,
   jsonb_build_object('id',b.id,'name',b.name,'difficultyId',b.difficulty_id,'color',color)) returning id into g;
 insert into public.internal_arena_pairings(tournament_id,game_id,white_student_id,black_student_id,bot_id,bot_color,bot_name)
 values(t.id,g,w,k,b.id,color,b.name);
 update public.internal_arena_entries set status='playing',current_game_id=g where id in (e.id,c.id);
 return jsonb_build_object('status','matched','gameId',g);
end;
$function$;

CREATE OR REPLACE FUNCTION public.match_internal_arena_bot_pair(p_tournament_id uuid, p_challenge_code text, p_initial_fen text, p_first_bot_id uuid DEFAULT NULL::uuid, p_second_bot_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  t public.internal_arena_tournaments%rowtype;
  a public.internal_arena_entries%rowtype; b public.internal_arena_entries%rowtype;
  w public.internal_arena_bots%rowtype; k public.internal_arena_bots%rowtype;
  ids uuid[]; swap_id uuid; g uuid; ms bigint;
begin
  select * into t from public.internal_arena_tournaments where id=p_tournament_id for update;
  if not found then raise exception 'Arena tournament not found.'; end if;
  if t.status='scheduled' and t.starts_at <= now() and t.ends_at > now() then
    update public.internal_arena_tournaments set status='active' where id=t.id; t.status:='active';
  end if;
  if t.status <> 'active' or t.ends_at <= now() then raise exception 'This Arena is not accepting new games.'; end if;
  if p_challenge_code is null or p_challenge_code !~ '^[A-Z0-9]{4}$' then raise exception 'Invalid challenge code.'; end if;
  if p_initial_fen is distinct from 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' then raise exception 'Arena games must use the starting position.'; end if;
  if (p_first_bot_id is null) <> (p_second_bot_id is null) then raise exception 'Choose two Arena bots.'; end if;
  if t.experience_version=1 then
    if p_first_bot_id is null then return jsonb_build_object('status','waiting','gameId',null); end if;
    if exists(select 1 from public.internal_arena_entries h join public.internal_arena_entries practice_entry
      on practice_entry.tournament_id=h.tournament_id and practice_entry.bot_id in (p_first_bot_id,p_second_bot_id)
      where h.tournament_id=t.id and public.arena_student_ready(t.id,h.student_id)
        and public.arena_entries_can_pair(t.id,h.id,practice_entry.id)) then
      raise exception 'These bots are reserved for waiting students.';
    end if;
  end if;
  if p_first_bot_id is not null then
    if p_first_bot_id=p_second_bot_id then raise exception 'Choose two different bots.'; end if;
    select * into a from public.internal_arena_entries where tournament_id=t.id and bot_id=p_first_bot_id for update;
    select * into b from public.internal_arena_entries where tournament_id=t.id and bot_id=p_second_bot_id for update;
    if a.id is null or b.id is null then raise exception 'Arena bot not found.'; end if;
    if a.status='playing' and b.status='playing' and a.current_game_id=b.current_game_id and exists (
      select 1 from public.live_chess_games where id=a.current_game_id and status='active' and arena_opponent_bot is not null
    ) then return jsonb_build_object('status','matched','gameId',a.current_game_id); end if;
    if a.status not in ('waiting','joined') or b.status not in ('waiting','joined') or a.current_game_id is not null or b.current_game_id is not null then
      raise exception 'Both bots must be available for pairing.';
    end if;
    if not public.arena_entries_can_pair(t.id, a.id, b.id) then
      raise exception 'These players were consecutive opponents. Choose a different pairing.';
    end if;
    ids:=array[p_first_bot_id,p_second_bot_id];
  else
    if exists (
      select 1 from public.internal_arena_entries e join public.students s on s.id=e.student_id
      where e.tournament_id=t.id and e.status='waiting' and s.is_active
        and (t.class_group is null or t.class_group=s.class_group)
        and not exists(select 1 from public.live_chess_games g where g.game_mode='live' and g.status='active'
          and (g.white_player_id=s.id or g.black_player_id=s.id))
    ) then return jsonb_build_object('status','waiting','gameId',null); end if;
    -- Search all eligible pairs, not just the oldest two (which may be a rematch).
    select array[first_entry.bot_id, second_entry.bot_id] into ids
    from public.internal_arena_entries first_entry
    join public.internal_arena_entries second_entry
      on second_entry.tournament_id=first_entry.tournament_id and first_entry.id < second_entry.id
    where first_entry.tournament_id=t.id
      and first_entry.bot_id is not null and second_entry.bot_id is not null
      and first_entry.status in ('waiting','joined') and second_entry.status in ('waiting','joined')
      and first_entry.current_game_id is null and second_entry.current_game_id is null
      and public.arena_entries_can_pair(t.id, first_entry.id, second_entry.id)
    order by least(first_entry.updated_at,second_entry.updated_at),
      greatest(first_entry.updated_at,second_entry.updated_at),first_entry.id,second_entry.id
    limit 1 for update of first_entry, second_entry;
    if coalesce(array_length(ids,1),0) <> 2 then return jsonb_build_object('status','waiting','gameId',null); end if;
  end if;
  if random()<0.5 then swap_id:=ids[1]; ids[1]:=ids[2]; ids[2]:=swap_id; end if;
  select * into w from public.internal_arena_bots where id=ids[1] and tournament_id=t.id;
  select * into k from public.internal_arena_bots where id=ids[2] and tournament_id=t.id;
  ms:=(t.time_control->>'initialMs')::bigint;
  insert into public.live_chess_games(challenge_code,created_by,white_player_id,black_player_id,status,time_control_id,time_control,
    initial_fen,current_fen,active_color,white_ms,black_ms,clock_started_at,started_at,rated,matchmaking,arena_tournament_id,arena_bot,arena_opponent_bot)
  values(p_challenge_code,null,null,null,'active',t.time_control_id,t.time_control,p_initial_fen,p_initial_fen,'white',ms,ms,now(),now(),false,true,t.id,
    jsonb_build_object('id',w.id,'name',w.name,'difficultyId',w.difficulty_id,'color','white'),
    jsonb_build_object('id',k.id,'name',k.name,'difficultyId',k.difficulty_id,'color','black')) returning id into g;
  insert into public.internal_arena_pairings(tournament_id,game_id,bot_id,bot_color,bot_name,opponent_bot_id,opponent_bot_name)
  values(t.id,g,w.id,'white',w.name,k.id,k.name);
  update public.internal_arena_entries set status='playing',current_game_id=g where tournament_id=t.id and bot_id=any(ids);
  return jsonb_build_object('status','matched','gameId',g);
end;
$function$;

CREATE OR REPLACE FUNCTION public.finalize_internal_arena_game(p_game_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_pairing public.internal_arena_pairings%rowtype;
  v_game public.live_chess_games%rowtype;
  v_tournament public.internal_arena_tournaments%rowtype;
  v_result text;
  v_white_points integer;
  v_black_points integer;
  v_next_status text;
  v_now timestamptz := now();
begin
  -- All Arena mutations acquire the tournament lock before entry/pairing locks.
  perform 1 from public.internal_arena_tournaments where id=(select tournament_id from public.internal_arena_pairings where game_id=p_game_id) for update;
  select * into v_pairing from public.internal_arena_pairings
  where game_id = p_game_id for update;
  if not found then return jsonb_build_object('tracked', false); end if;

  select * into v_game from public.live_chess_games where id = p_game_id;
  if v_game.status <> 'completed' then raise exception 'Arena game is not completed.'; end if;
  select * into v_tournament from public.internal_arena_tournaments where id = v_pairing.tournament_id for update;

  if v_pairing.status = 'completed' then
    return jsonb_build_object(
      'tracked', true, 'alreadyFinalized', true,
      'tournamentId', v_pairing.tournament_id,
      'whiteStudentId', v_pairing.white_student_id,
      'blackStudentId', v_pairing.black_student_id
    );
  end if;

  if v_game.winner_color = 'white' then
    v_result := 'white_win'; v_white_points := 2 + case when v_game.white_berserk and (select count(*) from jsonb_array_elements(v_game.moves) as m where m->>'color' = 'white') >= 7 then 1 else 0 end; v_black_points := 0;
  elsif v_game.winner_color = 'black' then
    v_result := 'black_win'; v_white_points := 0; v_black_points := 2 + case when v_game.black_berserk and (select count(*) from jsonb_array_elements(v_game.moves) as m where m->>'color' = 'black') >= 7 then 1 else 0 end;
  else
    v_result := 'draw'; v_white_points := 1; v_black_points := 1;
  end if;

  if v_tournament.status = 'active' and v_tournament.ends_at > v_now then
    v_next_status := 'waiting';
  else
    v_next_status := 'finished';
    if v_tournament.status = 'active' then
      update public.internal_arena_tournaments set status = 'finished' where id = v_tournament.id;
    end if;
  end if;

  update public.internal_arena_pairings
  set status = 'completed', result = v_result,
      white_points = v_white_points, black_points = v_black_points,
      completed_at = coalesce(v_game.completed_at, v_now)
  where id = v_pairing.id;

  update public.internal_arena_entries
  set status = case when bot_id in (select id from public.internal_arena_bots where tournament_id=v_pairing.tournament_id and removed_at is not null) then 'withdrawn' else v_next_status end, current_game_id = null,
      score = score + v_white_points,
      games_played = games_played + 1,
      wins = wins + case when v_result = 'white_win' then 1 else 0 end,
      draws = draws + case when v_result = 'draw' then 1 else 0 end,
      losses = losses + case when v_result = 'black_win' then 1 else 0 end
  where tournament_id = v_pairing.tournament_id and (student_id = v_pairing.white_student_id or (bot_id = v_pairing.bot_id and v_pairing.bot_color = 'white')
      or (bot_id = v_pairing.opponent_bot_id and v_pairing.bot_color = 'black'));

  update public.internal_arena_entries
  set status = case when bot_id in (select id from public.internal_arena_bots where tournament_id=v_pairing.tournament_id and removed_at is not null) then 'withdrawn' else v_next_status end, current_game_id = null,
      score = score + v_black_points,
      games_played = games_played + 1,
      wins = wins + case when v_result = 'black_win' then 1 else 0 end,
      draws = draws + case when v_result = 'draw' then 1 else 0 end,
      losses = losses + case when v_result = 'white_win' then 1 else 0 end
  where tournament_id = v_pairing.tournament_id and (student_id = v_pairing.black_student_id or (bot_id = v_pairing.bot_id and v_pairing.bot_color = 'black')
      or (bot_id = v_pairing.opponent_bot_id and v_pairing.bot_color = 'white'));

  return jsonb_build_object(
    'tracked', true, 'alreadyFinalized', false,
    'tournamentId', v_pairing.tournament_id,
    'whiteStudentId', v_pairing.white_student_id,
    'blackStudentId', v_pairing.black_student_id
  );
end;
$function$;


create function public.pair_arena_waiting_students(p_tournament_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.internal_arena_tournaments%rowtype; e record; result jsonb; code text; attempt integer;
begin
 select * into t from public.internal_arena_tournaments where id=p_tournament_id for update;
 if not found or t.experience_version<>1 or t.pairings_paused or t.ends_at<=now()
   or t.status not in ('scheduled','active') or t.starts_at>now() then return '{}'::jsonb; end if;
 update public.internal_arena_tournaments set status='active' where id=t.id and status='scheduled';
 for e in select student_id from public.internal_arena_entries
   where tournament_id=t.id and public.arena_student_ready(t.id,student_id)
   order by queue_entered_at,id limit 100
 loop
   if not public.arena_student_ready(t.id,e.student_id) then continue; end if;
   for attempt in 1..8 loop
     begin
       code:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,4));
       result:=public.match_internal_arena_student(t.id,e.student_id,code,'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
       if result->>'status'<>'matched' then
         result:=public.match_internal_arena_bot(t.id,e.student_id,code,'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
       end if;
       exit;
     exception when unique_violation then
       if attempt=8 then raise; end if;
     end;
   end loop;
 end loop;
 return '{}'::jsonb;
end;
$$;

CREATE OR REPLACE FUNCTION public.force_internal_arena_pair(p_tournament_id uuid, p_first_student_id uuid, p_second_student_id uuid, p_challenge_code text, p_initial_fen text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_tournament public.internal_arena_tournaments%rowtype;
  v_first public.internal_arena_entries%rowtype;
  v_second public.internal_arena_entries%rowtype;
  v_game_id uuid;
  v_white_id uuid;
  v_black_id uuid;
  v_initial_ms bigint;
  v_now timestamptz := now();
begin
  if p_first_student_id = p_second_student_id then raise exception 'Choose two different students.'; end if;
  if p_challenge_code !~ '^[A-Z0-9]{4}$' then raise exception 'Invalid challenge code.'; end if;

  select * into v_tournament from public.internal_arena_tournaments
  where id = p_tournament_id for update;
  if not found then raise exception 'Arena tournament not found.'; end if;
  if v_tournament.status <> 'active' or v_tournament.ends_at <= v_now then
    raise exception 'This Arena is not accepting new games.';
  end if;

  select * into v_first from public.internal_arena_entries
  where tournament_id = p_tournament_id and student_id = p_first_student_id for update;
  select * into v_second from public.internal_arena_entries
  where tournament_id = p_tournament_id and student_id = p_second_student_id for update;
  if v_first.id is null or v_second.id is null then raise exception 'Both students must join the Arena first.'; end if;
  if v_first.status in ('playing', 'withdrawn', 'finished') or v_second.status in ('playing', 'withdrawn', 'finished') then
    raise exception 'Both students must be available for pairing.';
  end if;
  if exists (
    select 1 from public.live_chess_games
    where game_mode = 'live'
      and status = 'active'
      and (
        white_player_id in (p_first_student_id, p_second_student_id)
        or black_player_id in (p_first_student_id, p_second_student_id)
      )
  ) then
    raise exception 'One of these students already has an active live game.';
  end if;

  if v_tournament.experience_version=1 and
    (not public.arena_student_ready(p_tournament_id,p_first_student_id) or not public.arena_student_ready(p_tournament_id,p_second_student_id)) then
    raise exception 'Both students must be online and in the queue.';
  end if;
  if not public.arena_entries_can_pair(p_tournament_id, v_first.id, v_second.id) then
    raise exception 'These players were consecutive opponents. Choose a different pairing.';
  end if;

  if random() < 0.5 then
    v_white_id := p_first_student_id;
    v_black_id := p_second_student_id;
  else
    v_white_id := p_second_student_id;
    v_black_id := p_first_student_id;
  end if;
  v_initial_ms := nullif(v_tournament.time_control ->> 'initialMs', '')::bigint;

  insert into public.live_chess_games(
    challenge_code, created_by, white_player_id, black_player_id, status,
    time_control_id, time_control, initial_fen, current_fen, active_color,
    white_ms, black_ms, clock_started_at, started_at, rated, matchmaking,
    arena_tournament_id
  ) values (
    p_challenge_code, p_first_student_id, v_white_id, v_black_id, 'active',
    v_tournament.time_control_id, v_tournament.time_control, p_initial_fen, p_initial_fen, 'white',
    v_initial_ms, v_initial_ms, v_now, v_now, v_tournament.rated, true,
    p_tournament_id
  ) returning id into v_game_id;

  insert into public.internal_arena_pairings(
    tournament_id, game_id, white_student_id, black_student_id, started_at
  ) values (p_tournament_id, v_game_id, v_white_id, v_black_id, v_now);

  update public.internal_arena_entries
  set status = 'playing', current_game_id = v_game_id
  where id in (v_first.id, v_second.id);

  return jsonb_build_object('status', 'matched', 'gameId', v_game_id);
end;
$function$;
;

create function public.arena_student_standings(p_tournament_id uuid,p_eligible_only boolean default false)
returns jsonb language sql stable security invoker set search_path='' as $$
 with entrants as (
   select e.student_id,s.display_name as name,e.score,e.wins,e.draws,e.losses,e.games_played
   from public.internal_arena_entries e join public.students s on s.id=e.student_id
   where e.tournament_id=p_tournament_id
     and (not p_eligible_only or e.games_played>0)
 ), head as (
   select e.*,
     case when exists(
       select 1 from entrants a join entrants b on a.student_id<b.student_id
       where a.score=e.score and a.wins=e.wins and b.score=e.score and b.wins=e.wins
       and not exists(select 1 from public.internal_arena_pairings p where p.tournament_id=p_tournament_id and p.status='completed'
         and ((p.white_student_id=a.student_id and p.black_student_id=b.student_id) or (p.white_student_id=b.student_id and p.black_student_id=a.student_id)))
     ) then 0 else coalesce((
       select sum(case when p.white_student_id=e.student_id then p.white_points else p.black_points end)
       from public.internal_arena_pairings p join entrants opponent
       on opponent.student_id=case when p.white_student_id=e.student_id then p.black_student_id else p.white_student_id end
       where p.tournament_id=p_tournament_id and p.status='completed'
         and e.student_id in (p.white_student_id,p.black_student_id)
         and opponent.score=e.score and opponent.wins=e.wins
     ),0) end as head_points
   from entrants e
 ), ranked as (
   select *,rank() over(order by score desc,wins desc,head_points desc) as place,
     count(*) over(partition by score,wins,head_points) as tied_count
   from head
 )
 select coalesce(jsonb_agg(jsonb_build_object('studentId',student_id,'name',name,'rank',place,
   'score',score,'wins',wins,'draws',draws,'losses',losses,'gamesPlayed',games_played,
   'tiedCount',tied_count,'headToHead',head_points,
   'coins',case when games_played=0 then 0 else (
     select coalesce(sum(case position when 1 then 100 when 2 then 50 when 3 then 30 else 0 end),0)/tied_count
     from generate_series(place,place+tied_count-1) position
   ) end
 ) order by place,name,student_id),'[]'::jsonb) from ranked;
$$;

create function public.settle_internal_arena(p_tournament_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.internal_arena_tournaments%rowtype; standings jsonb; prize jsonb;
begin
 select * into t from public.internal_arena_tournaments where id=p_tournament_id for update;
 if not found or t.experience_version<>1 or t.status='cancelled' then return null; end if;
 select r.standings into standings from public.internal_arena_results r where r.tournament_id=t.id;
 if found then return standings; end if;
 if t.status<>'finished' and t.ends_at>now() then return null; end if;
 if exists(select 1 from public.internal_arena_pairings where tournament_id=t.id and status='active') then return null; end if;
 update public.internal_arena_tournaments set status='finished' where id=t.id;
 update public.internal_arena_entries set status='finished' where tournament_id=t.id and status in ('joined','waiting');
 standings:=public.arena_student_standings(t.id,true);
 insert into public.internal_arena_results(tournament_id,standings) values(t.id,standings);
 -- Stable student ordering also avoids wallet-lock inversions across tournaments.
 for prize in select value from jsonb_array_elements(standings) order by value->>'studentId' loop
   if (prize->>'coins')::integer>0 then
     perform public.grant_academy_coins((prize->>'studentId')::uuid,(prize->>'coins')::integer,
       'earn','arena_podium',t.id::text,'Arena prize: '||t.name||' · place '||(prize->>'rank'),
       'arena-podium:'||t.id::text||':'||(prize->>'studentId'));
     insert into public.activity_events(student_id,event_type,title,description)
       values((prize->>'studentId')::uuid,'coins_earned','Arena podium prize',
         t.name||' · place '||(prize->>'rank')||' · +'||(prize->>'coins')||' coins.');
   end if;
 end loop;
 return standings;
end;
$$;

-- Read several arena ranks in one round-trip; clients never supply ranks or prizes.
create function public.arena_rankings(p_tournament_ids uuid[]) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_object_agg(t.id,coalesce(r.standings,public.arena_student_standings(t.id,false))),'{}'::jsonb)
 from public.internal_arena_tournaments t left join public.internal_arena_results r on r.tournament_id=t.id
 where t.id=any(p_tournament_ids) and t.experience_version=1;
$$;

revoke all on function public.arena_entry_queue_timing() from public,anon,authenticated;
grant execute on function public.arena_entry_queue_timing() to service_role;

revoke all on function public.arena_student_ready(uuid,uuid) from public,anon,authenticated;
grant execute on function public.arena_student_ready(uuid,uuid) to service_role;

revoke all on function public.arena_queue_presence(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.arena_queue_presence(uuid,uuid,text) to service_role;

revoke all on function public.pair_arena_waiting_students(uuid) from public,anon,authenticated;
grant execute on function public.pair_arena_waiting_students(uuid) to service_role;

revoke all on function public.arena_student_standings(uuid,boolean) from public,anon,authenticated;
grant execute on function public.arena_student_standings(uuid,boolean) to service_role;

revoke all on function public.settle_internal_arena(uuid) from public,anon,authenticated;
grant execute on function public.settle_internal_arena(uuid) to service_role;

revoke all on function public.arena_rankings(uuid[]) from public,anon,authenticated;
grant execute on function public.arena_rankings(uuid[]) to service_role;
-- The same lock serializes teacher actions, pairings, and prize settlement.
create function public.control_internal_arena(p_tournament_id uuid,p_action text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare t public.internal_arena_tournaments%rowtype;
begin
 select * into t from public.internal_arena_tournaments where id=p_tournament_id for update;
 if not found then raise exception 'Arena not found.'; end if;
 if t.status in ('finished','cancelled') or exists(select 1 from public.internal_arena_results where tournament_id=t.id) then
   raise exception 'This Arena has ended and cannot be changed.';
 end if;
 if p_action='start' and t.status='scheduled' then
   update public.internal_arena_tournaments set status='active',starts_at=now(),ends_at=now()+make_interval(mins=>duration_minutes) where id=t.id;
 elsif p_action='finish' and t.status='active' then
   update public.internal_arena_tournaments set status='finished',ends_at=least(ends_at,clock_timestamp()) where id=t.id;
   update public.internal_arena_entries set status='finished' where tournament_id=t.id and status in ('joined','waiting');
 elsif p_action='cancel' then
   update public.internal_arena_tournaments set status='cancelled' where id=t.id;
   update public.internal_arena_entries set status='finished' where tournament_id=t.id and status in ('joined','waiting');
 elsif p_action in ('pause_pairings','resume_pairings') and t.ends_at>now() then
   update public.internal_arena_tournaments set pairings_paused=(p_action='pause_pairings') where id=t.id;
 else raise exception 'This action is not available for this Arena.';
 end if;
 select * into t from public.internal_arena_tournaments where id=t.id;
 return to_jsonb(t);
end;
$$;
revoke all on function public.control_internal_arena(uuid,text) from public,anon,authenticated;
grant execute on function public.control_internal_arena(uuid,text) to service_role;
create function public.unsettled_arena_ids() returns uuid[]
language sql stable security invoker set search_path='' as $$
 select coalesce(array_agg(t.id order by t.ends_at),'{}'::uuid[]) from public.internal_arena_tournaments t
 where t.experience_version=1 and t.status in ('active','finished')
 and not exists(select 1 from public.internal_arena_results r where r.tournament_id=t.id);
$$;
revoke all on function public.unsettled_arena_ids() from public,anon,authenticated;
grant execute on function public.unsettled_arena_ids() to service_role;

-- Recheck the actual wall clock after acquiring the lock, not the transaction-start timestamp.
create or replace function public.guard_arena_pairings_pause() returns trigger
language plpgsql security invoker set search_path='' as $$
declare t public.internal_arena_tournaments%rowtype;
begin
 if new.arena_tournament_id is not null then
   select * into t from public.internal_arena_tournaments where id=new.arena_tournament_id for update;
   if t.pairings_paused then raise exception 'Arena pairings are paused by the teacher.'; end if;
   if t.experience_version=1 and (t.status<>'active' or t.ends_at<=clock_timestamp()) then
     raise exception 'This Arena is not accepting new games.';
   end if;
 end if;
 return new;
end;
$$;
