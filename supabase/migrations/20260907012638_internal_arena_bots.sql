-- Real bot participants, not fake student accounts. Browser access stays revoked.
create table public.internal_arena_bots (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.internal_arena_tournaments(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  difficulty_id text not null check (difficulty_id in ('pawny','knight','bishop','rook','queen','so-pawny')),
  created_at timestamptz not null default now(),
  unique (id, tournament_id)
);
create index internal_arena_bots_tournament_idx on public.internal_arena_bots(tournament_id);
alter table public.internal_arena_bots enable row level security;
revoke all on public.internal_arena_bots from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.internal_arena_bots to service_role;

alter table public.internal_arena_entries alter column student_id drop not null;
alter table public.internal_arena_entries add column bot_id uuid;
alter table public.internal_arena_entries add constraint internal_arena_entry_bot_fk
  foreign key (bot_id,tournament_id) references public.internal_arena_bots(id,tournament_id) on delete cascade;
alter table public.internal_arena_entries add constraint internal_arena_entry_identity
  check ((student_id is not null)::integer + (bot_id is not null)::integer = 1);
create unique index internal_arena_entry_bot_unique on public.internal_arena_entries(bot_id) where bot_id is not null;

alter table public.live_chess_games add column arena_bot jsonb;
alter table public.live_chess_games add column bot_lease_until timestamptz;
-- Lease bookkeeping must not create refresh/broadcast loops. Player actions advance version.
drop trigger broadcast_live_chess_game_change on public.live_chess_games;
create trigger broadcast_live_chess_game_change after insert or update of version, status
on public.live_chess_games for each row execute function public.broadcast_live_chess_game_change();
alter table public.live_chess_games add constraint live_chess_games_bot_shape check (
  arena_bot is null or (
    jsonb_typeof(arena_bot) = 'object' and arena_tournament_id is not null
    and game_mode = 'live' and not rated and matchmaking
    and arena_bot->>'id' is not null and arena_bot->>'name' is not null
    and arena_bot->>'difficultyId' is not null
    and arena_bot->>'difficultyId' in ('pawny','knight','bishop','rook','queen','so-pawny')
    and arena_bot->>'color' is not null and (
      (arena_bot->>'color' = 'white' and white_player_id is null and black_player_id = created_by)
      or (arena_bot->>'color' = 'black' and black_player_id is null and white_player_id = created_by)
    )
  )
);
alter table public.live_chess_games drop constraint live_chess_games_status_shape;
alter table public.live_chess_games add constraint live_chess_games_status_shape check (
  (status = 'waiting' and arena_bot is null and (white_player_id is null or black_player_id is null) and started_at is null and completed_at is null)
  or (status = 'active' and (arena_bot is not null or (white_player_id is not null and black_player_id is not null)) and started_at is not null and completed_at is null)
  or (status = 'completed' and (arena_bot is not null or (white_player_id is not null and black_player_id is not null)) and started_at is not null and completed_at is not null and result_reason is not null)
  or (status = 'cancelled' and completed_at is not null)
);

alter table public.internal_arena_pairings alter column white_student_id drop not null;
alter table public.internal_arena_pairings alter column black_student_id drop not null;
alter table public.internal_arena_pairings add column bot_id uuid;
alter table public.internal_arena_pairings add column bot_color text;
alter table public.internal_arena_pairings add column bot_name text;
alter table public.internal_arena_pairings add constraint internal_arena_pairing_bot_fk
  foreign key (bot_id,tournament_id) references public.internal_arena_bots(id,tournament_id);
create index internal_arena_pairing_bot_idx on public.internal_arena_pairings(bot_id,tournament_id) where bot_id is not null;
alter table public.internal_arena_pairings add constraint internal_arena_pairing_identity check (
  (bot_id is null and bot_color is null and bot_name is null and white_student_id is not null and black_student_id is not null)
  or (bot_id is not null and bot_color is not null and bot_name is not null and char_length(btrim(bot_name)) between 1 and 40 and (
    (bot_color = 'white' and white_student_id is null and black_student_id is not null)
    or (bot_color = 'black' and black_student_id is null and white_student_id is not null)
  ))
);

create function public.manage_internal_arena_bot(p_tournament_id uuid, p_action text, p_bot_id uuid default null, p_name text default null, p_difficulty_id text default null)
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
  select * into e from public.internal_arena_entries where tournament_id=t.id and bot_id=p_bot_id and status <> 'withdrawn' for update;
  if not found then raise exception 'Arena bot not found.'; end if;
  if p_action='remove' then
    if e.status='playing' then raise exception 'Wait for this bot to finish its current game before removing it.'; end if;
    update public.internal_arena_entries set status='withdrawn' where id=e.id;
  else
    update public.internal_arena_bots set name=btrim(p_name),difficulty_id=p_difficulty_id where id=p_bot_id;
  end if;
  return p_bot_id;
end;
$$;

-- Human matchmaking remains unchanged and is always tried before the bot fallback.
create function public.match_internal_arena_bot(p_tournament_id uuid,p_student_id uuid,p_challenge_code text,p_initial_fen text,p_bot_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
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
 select * into c from public.internal_arena_entries where tournament_id=t.id and bot_id is not null
   and status in ('waiting','joined') and current_game_id is null and (p_bot_id is null or bot_id=p_bot_id)
   order by updated_at,id for update skip locked limit 1;
 if not found then
   if p_bot_id is not null then raise exception 'This bot is not available for pairing.'; end if;
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
$$;

-- A lease prevents concurrent polling/after-response jobs from calculating the same turn.
create function public.claim_internal_arena_bot_turn(p_game_id uuid)
returns setof public.live_chess_games language sql security invoker set search_path = '' as $$
 update public.live_chess_games set bot_lease_until=now()+interval '15 seconds'
 where id=p_game_id and status='active' and arena_bot is not null
   and (bot_lease_until is null or bot_lease_until < now())
   and (active_color=arena_bot->>'color'
     or clock_started_at + (case when active_color='white' then white_ms else black_ms end)*interval '1 millisecond' <= now())
 returning *;
$$;

revoke all on function public.manage_internal_arena_bot(uuid,text,uuid,text,text) from public,anon,authenticated;
revoke all on function public.match_internal_arena_bot(uuid,uuid,text,text,uuid) from public,anon,authenticated;
revoke all on function public.claim_internal_arena_bot_turn(uuid) from public,anon,authenticated;
grant execute on function public.manage_internal_arena_bot(uuid,text,uuid,text,text) to service_role;
grant execute on function public.match_internal_arena_bot(uuid,uuid,text,text,uuid) to service_role;
grant execute on function public.claim_internal_arena_bot_turn(uuid) to service_role;

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
  set status = v_next_status, current_game_id = null,
      score = score + v_white_points,
      games_played = games_played + 1,
      wins = wins + case when v_result = 'white_win' then 1 else 0 end,
      draws = draws + case when v_result = 'draw' then 1 else 0 end,
      losses = losses + case when v_result = 'black_win' then 1 else 0 end
  where tournament_id = v_pairing.tournament_id and (student_id = v_pairing.white_student_id or (bot_id = v_pairing.bot_id and v_pairing.bot_color = 'white'));

  update public.internal_arena_entries
  set status = v_next_status, current_game_id = null,
      score = score + v_black_points,
      games_played = games_played + 1,
      wins = wins + case when v_result = 'black_win' then 1 else 0 end,
      draws = draws + case when v_result = 'draw' then 1 else 0 end,
      losses = losses + case when v_result = 'white_win' then 1 else 0 end
  where tournament_id = v_pairing.tournament_id and (student_id = v_pairing.black_student_id or (bot_id = v_pairing.bot_id and v_pairing.bot_color = 'black'));

  return jsonb_build_object(
    'tracked', true, 'alreadyFinalized', false,
    'tournamentId', v_pairing.tournament_id,
    'whiteStudentId', v_pairing.white_student_id,
    'blackStudentId', v_pairing.black_student_id
  );
end;
$$;
