-- Retain all named presets and allow fifty interpolated strengths. No game data is rewritten.
create function public.valid_internal_arena_bot_difficulty(p_id text)
returns boolean language sql immutable security invoker set search_path = '' as $$
  select case
    when p_id in ('pawny','knight','bishop','rook','queen','so-pawny') then true
    when p_id ~ '^arena-[1-9][0-9]{2,3}$' then
      substring(p_id from 7)::integer between 375 and 1600 and substring(p_id from 7)::integer % 25 = 0
    else false
  end;
$$;
revoke all on function public.valid_internal_arena_bot_difficulty(text) from public,anon,authenticated;
grant execute on function public.valid_internal_arena_bot_difficulty(text) to service_role;

alter table public.internal_arena_bots drop constraint internal_arena_bots_difficulty_id_check;
alter table public.internal_arena_bots add constraint internal_arena_bots_difficulty_id_check
  check (public.valid_internal_arena_bot_difficulty(difficulty_id));

create or replace function public.manage_internal_arena_bot(p_tournament_id uuid, p_action text, p_bot_id uuid default null, p_name text default null, p_difficulty_id text default null)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare t public.internal_arena_tournaments%rowtype; b uuid; e public.internal_arena_entries%rowtype;
begin
  select * into t from public.internal_arena_tournaments where id=p_tournament_id for update;
  if not found then raise exception 'Arena tournament not found.'; end if;
  if t.status not in ('scheduled','active') or t.ends_at <= now() then raise exception 'This Arena is no longer accepting bot changes.'; end if;
  if p_action not in ('add','update','remove') or p_action is null then raise exception 'Invalid bot action.'; end if;
  if p_action <> 'remove' and (p_name is null or char_length(btrim(p_name)) not between 1 and 40
    or not public.valid_internal_arena_bot_difficulty(p_difficulty_id)) then
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
revoke all on function public.manage_internal_arena_bot(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.manage_internal_arena_bot(uuid,text,uuid,text,text) to service_role;

-- The entire identity/casual-game constraint is retained, including both bot snapshots.
alter table public.live_chess_games drop constraint live_chess_games_bot_shape;
alter table public.live_chess_games add constraint live_chess_games_bot_shape check (
  (arena_bot is null and arena_opponent_bot is null) or coalesce((
    jsonb_typeof(arena_bot) = 'object' and arena_tournament_id is not null
    and game_mode = 'live' and not rated and matchmaking
    and arena_bot->>'id' is not null and arena_bot->>'name' is not null
    and public.valid_internal_arena_bot_difficulty(arena_bot->>'difficultyId')
    and arena_bot->>'color' in ('white','black') and (
      (arena_opponent_bot is null and created_by is not null and (
        (arena_bot->>'color' = 'white' and white_player_id is null and black_player_id = created_by)
        or (arena_bot->>'color' = 'black' and black_player_id is null and white_player_id = created_by)
      )) or (
        jsonb_typeof(arena_opponent_bot) = 'object' and created_by is null
        and white_player_id is null and black_player_id is null
        and arena_opponent_bot->>'id' is not null and arena_opponent_bot->>'id' <> arena_bot->>'id'
        and arena_opponent_bot->>'name' is not null
        and public.valid_internal_arena_bot_difficulty(arena_opponent_bot->>'difficultyId')
        and arena_opponent_bot->>'color' in ('white','black')
        and arena_opponent_bot->>'color' <> arena_bot->>'color'
        and draw_offered_by is null and rematch_requested_by is null
      )
    )
  ), false)
);
