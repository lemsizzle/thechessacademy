-- Preserve existing human/bot games; a second snapshot represents bot-only games.
alter table public.internal_arena_bots add column removed_at timestamptz;

-- Retain playing entries and their result; retire them as soon as the game ends.
create or replace function public.manage_internal_arena_bot(p_tournament_id uuid, p_action text, p_bot_id uuid default null, p_name text default null, p_difficulty_id text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare t public.internal_arena_tournaments%rowtype; b uuid; e public.internal_arena_entries%rowtype;
begin
  select * into t from public.internal_arena_tournaments where id=p_tournament_id for update;
  if not found then raise exception 'Arena tournament not found.'; end if;
  if t.status not in ('scheduled','active') or t.ends_at <= now() then raise exception 'This Arena is no longer accepting bot changes.'; end if;
  if p_action not in ('add','update','remove') or p_action is null then raise exception 'Invalid bot action.'; end if;
  if p_action <> 'remove' and (p_name is null or char_length(btrim(p_name)) not between 1 and 40
    or p_difficulty_id is null or p_difficulty_id not in ('pawny','knight','bishop','rook','queen','so-pawny')) then
    raise exception 'Choose a valid bot name and skill level.';
  end if;
  if p_action='add' then
    if (select count(*) from public.internal_arena_entries where tournament_id=t.id and bot_id is not null and status <> 'withdrawn') >= 12 then
      raise exception 'An Arena can have at most 12 bots.';
    end if;
    insert into public.internal_arena_bots(tournament_id,name,difficulty_id) values(t.id,btrim(p_name),p_difficulty_id) returning id into b;
    insert into public.internal_arena_entries(tournament_id,bot_id,status) values(t.id,b,'waiting');
    return b;
  end if;
  select * into e from public.internal_arena_entries where tournament_id=t.id and bot_id=p_bot_id for update;
  if not found then raise exception 'Arena bot not found.'; end if;
  if p_action='remove' then
    update public.internal_arena_bots set removed_at=coalesce(removed_at,now()) where id=p_bot_id;
    update public.internal_arena_entries set status='withdrawn' where id=e.id and current_game_id is null;
  else
    if e.status='withdrawn' or exists(select 1 from public.internal_arena_bots where id=p_bot_id and removed_at is not null) then
      raise exception 'This bot has been removed from the Arena.';
    end if;
    update public.internal_arena_bots set name=btrim(p_name),difficulty_id=p_difficulty_id where id=p_bot_id;
  end if;
  return p_bot_id;
end;
$$;

alter table public.live_chess_games add column arena_opponent_bot jsonb;
alter table public.live_chess_games alter column created_by drop not null;
alter table public.live_chess_games add constraint live_chess_games_creator_required
  check (created_by is not null or arena_opponent_bot is not null);
alter table public.live_chess_games drop constraint live_chess_games_bot_shape;
alter table public.live_chess_games add constraint live_chess_games_bot_shape check (
  (arena_bot is null and arena_opponent_bot is null) or coalesce((
    jsonb_typeof(arena_bot) = 'object' and arena_tournament_id is not null
    and game_mode = 'live' and not rated and matchmaking
    and arena_bot->>'id' is not null and arena_bot->>'name' is not null
    and arena_bot->>'difficultyId' in ('pawny','knight','bishop','rook','queen','so-pawny')
    and arena_bot->>'color' in ('white','black') and (
      (arena_opponent_bot is null and created_by is not null and (
        (arena_bot->>'color' = 'white' and white_player_id is null and black_player_id = created_by)
        or (arena_bot->>'color' = 'black' and black_player_id is null and white_player_id = created_by)
      )) or (
        jsonb_typeof(arena_opponent_bot) = 'object' and created_by is null
        and white_player_id is null and black_player_id is null
        and arena_opponent_bot->>'id' is not null and arena_opponent_bot->>'id' <> arena_bot->>'id'
        and arena_opponent_bot->>'name' is not null
        and arena_opponent_bot->>'difficultyId' in ('pawny','knight','bishop','rook','queen','so-pawny')
        and arena_opponent_bot->>'color' in ('white','black')
        and arena_opponent_bot->>'color' <> arena_bot->>'color'
        and draw_offered_by is null and rematch_requested_by is null
      )
    )
  ), false)
);

alter table public.internal_arena_pairings add column opponent_bot_id uuid;
alter table public.internal_arena_pairings add column opponent_bot_name text;
alter table public.internal_arena_pairings add constraint internal_arena_pairing_opponent_bot_fk
  foreign key (opponent_bot_id,tournament_id) references public.internal_arena_bots(id,tournament_id);
create index internal_arena_pairing_opponent_bot_idx on public.internal_arena_pairings(opponent_bot_id,tournament_id)
  where opponent_bot_id is not null;
alter table public.internal_arena_pairings drop constraint internal_arena_pairing_identity;
alter table public.internal_arena_pairings add constraint internal_arena_pairing_identity check (
  (bot_id is null and bot_color is null and bot_name is null and opponent_bot_id is null and opponent_bot_name is null
    and white_student_id is not null and black_student_id is not null)
  or (bot_id is not null and bot_color is not null and bot_name is not null and char_length(btrim(bot_name)) between 1 and 40 and (
    (opponent_bot_id is null and opponent_bot_name is null and (
      (bot_color = 'white' and white_student_id is null and black_student_id is not null)
      or (bot_color = 'black' and black_student_id is null and white_student_id is not null)
    )) or (opponent_bot_id is not null and opponent_bot_id <> bot_id and opponent_bot_name is not null
      and char_length(btrim(opponent_bot_name)) between 1 and 40 and bot_color in ('white','black')
      and white_student_id is null and black_student_id is null)
  ))
);

-- Serializes with human matchmaking, skill changes, removal and tournament end.
-- Omitted bot IDs mean automatic pairing, which never takes a bot from a waiting human.
create function public.match_internal_arena_bot_pair(
  p_tournament_id uuid,p_challenge_code text,p_initial_fen text,
  p_first_bot_id uuid default null,p_second_bot_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
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
    ids:=array[p_first_bot_id,p_second_bot_id];
  else
    if exists (
      select 1 from public.internal_arena_entries e join public.students s on s.id=e.student_id
      where e.tournament_id=t.id and e.status='waiting' and s.is_active
        and (t.class_group is null or t.class_group=s.class_group)
        and not exists(select 1 from public.live_chess_games g where g.game_mode='live' and g.status='active'
          and (g.white_player_id=s.id or g.black_player_id=s.id))
    ) then return jsonb_build_object('status','waiting','gameId',null); end if;
    select array_agg(q.bot_id) into ids from (
      select bot_id from public.internal_arena_entries where tournament_id=t.id and bot_id is not null
        and status in ('waiting','joined') and current_game_id is null
      order by updated_at,id limit 2 for update
    ) q;
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
$$;
revoke all on function public.match_internal_arena_bot_pair(uuid,text,text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.match_internal_arena_bot_pair(uuid,text,text,uuid,uuid) to service_role;

create or replace function public.claim_internal_arena_bot_turn(p_game_id uuid)
returns setof public.live_chess_games language sql security invoker set search_path = '' as $$
  update public.live_chess_games set bot_lease_until=now()+interval '15 seconds'
  where id=p_game_id and status='active' and arena_bot is not null
    and (bot_lease_until is null or bot_lease_until < now())
    and (active_color=arena_bot->>'color' or active_color=arena_opponent_bot->>'color'
      or clock_started_at + (case when active_color='white' then white_ms else black_ms end)*interval '1 millisecond' <= now())
  returning *;
$$;

create or replace function public.finalize_internal_arena_game(p_game_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
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
    v_result := 'white_win'; v_white_points := 2; v_black_points := 0;
  elsif v_game.winner_color = 'black' then
    v_result := 'black_win'; v_white_points := 0; v_black_points := 2;
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
$$;
