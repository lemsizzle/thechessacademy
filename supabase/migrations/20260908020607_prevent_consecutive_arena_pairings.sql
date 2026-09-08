-- Enforce no consecutive opponents for both participants, including bots.
-- Existing tournament row locks serialize selection and insertion across all RPCs.
-- Uses existing tournament/time and participant indexes; no new student data is stored.
create or replace function public.arena_entries_can_pair(
  p_tournament_id uuid, p_first_entry_id uuid, p_second_entry_id uuid
) returns boolean language sql stable security invoker set search_path = '' as $$
  with participants as (
    select id,student_id,bot_id
    from public.internal_arena_entries
    where tournament_id=p_tournament_id and id in (p_first_entry_id,p_second_entry_id)
  )
  select (select count(*) from participants)=2 and not exists (
    select 1
    from participants player
    join participants opponent on opponent.id<>player.id
    cross join lateral (
      select p.white_student_id,p.black_student_id,p.bot_id,p.opponent_bot_id
      from public.internal_arena_pairings p
      where p.tournament_id=p_tournament_id and (
        (player.student_id is not null and player.student_id in (p.white_student_id,p.black_student_id))
        or (player.bot_id is not null and player.bot_id in (p.bot_id,p.opponent_bot_id))
      )
      order by p.started_at desc,p.id desc
      limit 1
    ) previous
    where (opponent.student_id is not null and opponent.student_id in (previous.white_student_id,previous.black_student_id))
       or (opponent.bot_id is not null and opponent.bot_id in (previous.bot_id,previous.opponent_bot_id))
  );
$$;
revoke all on function public.arena_entries_can_pair(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.arena_entries_can_pair(uuid,uuid,uuid) to service_role;

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
    and candidate.current_game_id is null
    and not exists (
      select 1 from public.live_chess_games game
      where game.game_mode = 'live'
        and game.status = 'active'
        and (game.white_player_id = candidate.student_id or game.black_player_id = candidate.student_id)
    )
  order by candidate.updated_at, candidate.joined_at, candidate.id
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
