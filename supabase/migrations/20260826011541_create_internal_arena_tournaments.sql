-- Durable in-app Arena tournaments. All reads and writes go through
-- authenticated Next.js routes using the service role; browser roles are denied.

create table if not exists public.internal_arena_tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  status text not null default 'scheduled',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  duration_minutes integer not null,
  time_control_id text not null,
  time_control jsonb not null,
  rated boolean not null default false,
  class_group text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_arena_name_length check (char_length(btrim(name)) between 1 and 100),
  constraint internal_arena_status_valid check (status in ('scheduled', 'active', 'finished', 'cancelled')),
  constraint internal_arena_duration_valid check (duration_minutes between 10 and 240),
  constraint internal_arena_window_valid check (ends_at > starts_at),
  constraint internal_arena_time_control_valid check (time_control_id in ('10m', '10+5', '15+10')),
  constraint internal_arena_time_control_object check (jsonb_typeof(time_control) = 'object')
);

alter table public.live_chess_games
  add column if not exists arena_tournament_id uuid references public.internal_arena_tournaments(id) on delete set null;

create table if not exists public.internal_arena_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.internal_arena_tournaments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'joined',
  score integer not null default 0,
  games_played integer not null default 0,
  wins integer not null default 0,
  draws integer not null default 0,
  losses integer not null default 0,
  current_game_id uuid references public.live_chess_games(id) on delete set null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_arena_entry_unique unique (tournament_id, student_id),
  constraint internal_arena_entry_status_valid check (status in ('joined', 'waiting', 'playing', 'withdrawn', 'finished')),
  constraint internal_arena_entry_score_valid check (score >= 0),
  constraint internal_arena_entry_totals_valid check (
    games_played >= 0 and wins >= 0 and draws >= 0 and losses >= 0
    and games_played = wins + draws + losses
  ),
  constraint internal_arena_entry_game_shape check (
    (status = 'playing' and current_game_id is not null)
    or (status <> 'playing' and current_game_id is null)
  )
);

create table if not exists public.internal_arena_pairings (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.internal_arena_tournaments(id) on delete cascade,
  game_id uuid not null unique references public.live_chess_games(id) on delete cascade,
  white_student_id uuid not null references public.students(id) on delete cascade,
  black_student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'active',
  result text,
  white_points integer not null default 0,
  black_points integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint internal_arena_pairing_players_distinct check (white_student_id <> black_student_id),
  constraint internal_arena_pairing_status_valid check (status in ('active', 'completed')),
  constraint internal_arena_pairing_result_valid check (result is null or result in ('white_win', 'black_win', 'draw')),
  constraint internal_arena_pairing_points_valid check (white_points between 0 and 2 and black_points between 0 and 2),
  constraint internal_arena_pairing_shape check (
    (status = 'active' and result is null and completed_at is null)
    or (status = 'completed' and result is not null and completed_at is not null)
  )
);

create index if not exists internal_arena_tournaments_status_time_idx
  on public.internal_arena_tournaments(status, starts_at, ends_at);
create index if not exists internal_arena_tournaments_class_status_idx
  on public.internal_arena_tournaments(class_group, status, starts_at);
create index if not exists internal_arena_entries_queue_idx
  on public.internal_arena_entries(tournament_id, status, updated_at, joined_at)
  where status in ('joined', 'waiting');
create index if not exists internal_arena_entries_student_idx
  on public.internal_arena_entries(student_id, tournament_id);
create index if not exists internal_arena_entries_current_game_idx
  on public.internal_arena_entries(current_game_id)
  where current_game_id is not null;
create index if not exists internal_arena_pairings_tournament_time_idx
  on public.internal_arena_pairings(tournament_id, started_at desc);
create index if not exists internal_arena_pairings_white_idx
  on public.internal_arena_pairings(white_student_id, started_at desc);
create index if not exists internal_arena_pairings_black_idx
  on public.internal_arena_pairings(black_student_id, started_at desc);
create index if not exists live_chess_games_arena_status_idx
  on public.live_chess_games(arena_tournament_id, status, updated_at desc)
  where arena_tournament_id is not null;

alter table public.internal_arena_tournaments enable row level security;
alter table public.internal_arena_entries enable row level security;
alter table public.internal_arena_pairings enable row level security;

revoke all on table public.internal_arena_tournaments from public, anon, authenticated, service_role;
revoke all on table public.internal_arena_entries from public, anon, authenticated, service_role;
revoke all on table public.internal_arena_pairings from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.internal_arena_tournaments to service_role;
grant select, insert, update, delete on table public.internal_arena_entries to service_role;
grant select, insert, update, delete on table public.internal_arena_pairings to service_role;

create policy "Internal Arena tournaments are server-only"
on public.internal_arena_tournaments for all to anon, authenticated
using (false) with check (false);
create policy "Internal Arena entries are server-only"
on public.internal_arena_entries for all to anon, authenticated
using (false) with check (false);
create policy "Internal Arena pairings are server-only"
on public.internal_arena_pairings for all to anon, authenticated
using (false) with check (false);

create or replace function public.set_internal_arena_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_internal_arena_updated_at() from public, anon, authenticated;

create trigger set_internal_arena_tournament_updated_at
before update on public.internal_arena_tournaments
for each row execute function public.set_internal_arena_updated_at();
create trigger set_internal_arena_entry_updated_at
before update on public.internal_arena_entries
for each row execute function public.set_internal_arena_updated_at();

create or replace function public.match_internal_arena_student(
  p_tournament_id uuid,
  p_student_id uuid,
  p_challenge_code text,
  p_initial_fen text,
  p_avoid_student_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
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
    where status = 'active'
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
    and candidate.status = 'waiting'
    and candidate.current_game_id is null
    and not exists (
      select 1 from public.live_chess_games game
      where game.status = 'active'
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
$$;

create or replace function public.force_internal_arena_pair(
  p_tournament_id uuid,
  p_first_student_id uuid,
  p_second_student_id uuid,
  p_challenge_code text,
  p_initial_fen text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
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
    where status = 'active'
      and (white_player_id in (p_first_student_id, p_second_student_id)
        or black_player_id in (p_first_student_id, p_second_student_id))
  ) then
    raise exception 'One of these students already has an active live game.';
  end if;

  if random() < 0.5 then
    v_white_id := p_first_student_id; v_black_id := p_second_student_id;
  else
    v_white_id := p_second_student_id; v_black_id := p_first_student_id;
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
  set status = v_next_status, current_game_id = null,
      score = score + v_white_points,
      games_played = games_played + 1,
      wins = wins + case when v_result = 'white_win' then 1 else 0 end,
      draws = draws + case when v_result = 'draw' then 1 else 0 end,
      losses = losses + case when v_result = 'black_win' then 1 else 0 end
  where tournament_id = v_pairing.tournament_id and student_id = v_pairing.white_student_id;

  update public.internal_arena_entries
  set status = v_next_status, current_game_id = null,
      score = score + v_black_points,
      games_played = games_played + 1,
      wins = wins + case when v_result = 'black_win' then 1 else 0 end,
      draws = draws + case when v_result = 'draw' then 1 else 0 end,
      losses = losses + case when v_result = 'white_win' then 1 else 0 end
  where tournament_id = v_pairing.tournament_id and student_id = v_pairing.black_student_id;

  return jsonb_build_object(
    'tracked', true, 'alreadyFinalized', false,
    'tournamentId', v_pairing.tournament_id,
    'whiteStudentId', v_pairing.white_student_id,
    'blackStudentId', v_pairing.black_student_id
  );
end;
$$;

revoke all on function public.match_internal_arena_student(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.force_internal_arena_pair(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.finalize_internal_arena_game(uuid) from public, anon, authenticated;
grant execute on function public.match_internal_arena_student(uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.force_internal_arena_pair(uuid, uuid, uuid, text, text) to service_role;
grant execute on function public.finalize_internal_arena_game(uuid) to service_role;

comment on table public.internal_arena_tournaments is
  'Teacher-created in-app Arena events using the server-authoritative live chess engine.';
comment on table public.internal_arena_entries is
  'Durable Arena enrollment, queue state, and 2/1/0 standings per student.';
comment on table public.internal_arena_pairings is
  'Idempotent mapping between Arena pairings and completed live chess games.';
