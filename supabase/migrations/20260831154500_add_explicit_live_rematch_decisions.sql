create or replace function public.resolve_live_chess_rematch(
  p_game_id uuid,
  p_student_id uuid,
  p_decision text,
  p_expected_version integer,
  p_challenge_code text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_game public.live_chess_games%rowtype;
  v_rematch_id uuid;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_now timestamptz := now();
begin
  if v_decision not in ('request', 'accept', 'decline') then
    raise exception 'Choose whether to request, accept, or decline the rematch.';
  end if;

  select * into v_game
  from public.live_chess_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Live game not found.';
  end if;
  if v_game.game_mode <> 'live' then
    raise exception 'Send a new correspondence challenge instead.';
  end if;
  if v_game.status <> 'completed' then
    raise exception 'Rematches are available after the game is completed.';
  end if;
  if p_student_id <> v_game.white_player_id and p_student_id <> v_game.black_player_id then
    raise exception 'You are not a player in this game.';
  end if;
  if p_expected_version is null or p_expected_version <> v_game.version then
    raise exception 'The game changed. Refresh and try again.';
  end if;
  if v_game.rematch_game_id is not null then
    raise exception 'This rematch has already been resolved.';
  end if;

  if v_decision = 'request' then
    if v_game.rematch_requested_by is null then
      update public.live_chess_games
      set rematch_requested_by = p_student_id,
          version = version + 1
      where id = p_game_id;
      return jsonb_build_object('status', 'waiting', 'gameId', null);
    end if;
    if v_game.rematch_requested_by = p_student_id then
      return jsonb_build_object('status', 'waiting', 'gameId', null);
    end if;
    raise exception 'Your opponent already requested a rematch. Accept or decline it.';
  end if;

  if v_game.rematch_requested_by is null then
    raise exception 'There is no rematch request to respond to.';
  end if;
  if v_game.rematch_requested_by = p_student_id then
    raise exception 'Only your opponent can respond to your rematch request.';
  end if;

  if v_decision = 'decline' then
    update public.live_chess_games
    set rematch_requested_by = null,
        version = version + 1
    where id = p_game_id;
    return jsonb_build_object('status', 'declined', 'gameId', null);
  end if;

  if not (
    p_challenge_code ~ '^[A-Z0-9]{4}$'
    or p_challenge_code ~ '^[A-HJ-NP-Z2-9]{12}$'
  ) then
    raise exception 'Invalid challenge code.';
  end if;
  if exists (
    select 1 from public.live_chess_games game
    where game.game_mode = 'live'
      and game.status = 'active'
      and game.id <> p_game_id
      and (
        game.white_player_id in (v_game.white_player_id, v_game.black_player_id)
        or game.black_player_id in (v_game.white_player_id, v_game.black_player_id)
      )
  ) then
    raise exception 'A player already has another active live game.';
  end if;

  insert into public.live_chess_games(
    challenge_code, created_by, white_player_id, black_player_id, status,
    time_control_id, time_control, initial_fen, current_fen, active_color,
    white_ms, black_ms, clock_started_at, started_at, rated, matchmaking,
    rematch_of_game_id
  ) values (
    p_challenge_code, p_student_id, v_game.black_player_id, v_game.white_player_id, 'active',
    v_game.time_control_id, v_game.time_control, v_game.initial_fen, v_game.initial_fen, 'white',
    nullif(v_game.time_control ->> 'initialMs', '')::bigint,
    nullif(v_game.time_control ->> 'initialMs', '')::bigint,
    case when v_game.time_control ->> 'initialMs' is null then null else v_now end,
    v_now, v_game.rated, false, v_game.id
  ) returning id into v_rematch_id;

  update public.live_chess_games
  set rematch_requested_by = null,
      rematch_game_id = v_rematch_id,
      version = version + 1
  where id = v_game.id;

  return jsonb_build_object('status', 'matched', 'gameId', v_rematch_id);
end;
$$;

revoke all on function public.resolve_live_chess_rematch(uuid, uuid, text, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.resolve_live_chess_rematch(uuid, uuid, text, integer, text)
  to service_role;

comment on function public.resolve_live_chess_rematch(uuid, uuid, text, integer, text) is
  'Atomically requests, accepts, or declines live-game rematches with optimistic version checks.';
