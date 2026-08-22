-- Phase 11: server-authoritative Academy ratings, rated/casual matchmaking,
-- rematches, rating history, and teacher moderation. Browser database roles
-- remain denied; authenticated Next.js routes call these functions with the
-- service-role client after validating the custom Academy session.

alter table public.live_chess_games
  add column if not exists rated boolean not null default false,
  add column if not exists matchmaking boolean not null default false,
  add column if not exists rating_applied_at timestamptz,
  add column if not exists rematch_requested_by uuid references public.students(id) on delete set null,
  add column if not exists rematch_game_id uuid references public.live_chess_games(id) on delete set null,
  add column if not exists rematch_of_game_id uuid references public.live_chess_games(id) on delete set null;

alter table public.live_chess_games
  drop constraint if exists live_chess_games_rematch_request_player;
alter table public.live_chess_games
  add constraint live_chess_games_rematch_request_player check (
    rematch_requested_by is null
    or rematch_requested_by = white_player_id
    or rematch_requested_by = black_player_id
  );

create index if not exists live_chess_games_rating_pending_idx
  on public.live_chess_games(completed_at, id)
  where rated and status = 'completed' and rating_applied_at is null;
create index if not exists live_chess_games_rematch_of_idx
  on public.live_chess_games(rematch_of_game_id)
  where rematch_of_game_id is not null;

create table if not exists public.student_chess_ratings (
  student_id uuid primary key references public.students(id) on delete cascade,
  rating integer not null default 1200,
  peak_rating integer not null default 1200,
  rated_games integer not null default 0,
  wins integer not null default 0,
  draws integer not null default 0,
  losses integer not null default 0,
  provisional boolean not null default true,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_chess_ratings_rating_valid check (rating between 100 and 3000),
  constraint student_chess_ratings_peak_valid check (peak_rating between 100 and 3000 and peak_rating >= rating),
  constraint student_chess_ratings_counts_valid check (
    rated_games >= 0 and wins >= 0 and draws >= 0 and losses >= 0
    and rated_games = wins + draws + losses
  ),
  constraint student_chess_ratings_version_positive check (version > 0),
  constraint student_chess_ratings_provisional_shape check (provisional = (rated_games < 10))
);

create index if not exists student_chess_ratings_leaderboard_idx
  on public.student_chess_ratings(rating desc, rated_games desc, student_id);

create table if not exists public.chess_rating_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  event_type text not null,
  game_id uuid references public.live_chess_games(id) on delete cascade,
  opponent_id uuid references public.students(id) on delete set null,
  result text,
  rating_before integer not null,
  rating_after integer not null,
  rating_change integer not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint chess_rating_events_type_valid check (event_type in ('game', 'admin')),
  constraint chess_rating_events_result_valid check (result is null or result in ('win', 'draw', 'loss')),
  constraint chess_rating_events_ratings_valid check (
    rating_before between 100 and 3000
    and rating_after between 100 and 3000
    and rating_change = rating_after - rating_before
  ),
  constraint chess_rating_events_shape check (
    (event_type = 'game' and game_id is not null and opponent_id is not null and result is not null)
    or (event_type = 'admin' and game_id is null and opponent_id is null and result is null)
  ),
  constraint chess_rating_events_reason_length check (char_length(reason) between 1 and 500)
);

create unique index if not exists chess_rating_events_game_student_unique
  on public.chess_rating_events(game_id, student_id)
  where game_id is not null;
create index if not exists chess_rating_events_student_created_idx
  on public.chess_rating_events(student_id, created_at desc, id desc);
create index if not exists chess_rating_events_opponent_idx
  on public.chess_rating_events(opponent_id)
  where opponent_id is not null;

create table if not exists public.live_chess_matchmaking_tickets (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  time_control_id text not null,
  rated boolean not null default true,
  student_rating integer not null,
  status text not null default 'waiting',
  matched_game_id uuid references public.live_chess_games(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_chess_matchmaking_time_control_valid check (time_control_id in ('10m', '10+5', '15+10')),
  constraint live_chess_matchmaking_rating_valid check (student_rating between 100 and 3000),
  constraint live_chess_matchmaking_status_valid check (status in ('waiting', 'matched', 'cancelled', 'expired')),
  constraint live_chess_matchmaking_status_shape check (
    (status = 'matched' and matched_game_id is not null)
    or (status <> 'matched' and matched_game_id is null)
  )
);

create unique index if not exists live_chess_matchmaking_one_waiting_per_student
  on public.live_chess_matchmaking_tickets(student_id)
  where status = 'waiting';
create index if not exists live_chess_matchmaking_candidate_idx
  on public.live_chess_matchmaking_tickets(time_control_id, rated, status, created_at, student_rating)
  where status = 'waiting';
create index if not exists live_chess_matchmaking_student_created_idx
  on public.live_chess_matchmaking_tickets(student_id, created_at desc, id desc);
create index if not exists live_chess_matchmaking_game_idx
  on public.live_chess_matchmaking_tickets(matched_game_id)
  where matched_game_id is not null;

alter table public.student_chess_ratings enable row level security;
alter table public.chess_rating_events enable row level security;
alter table public.live_chess_matchmaking_tickets enable row level security;

revoke all on table public.student_chess_ratings from public, anon, authenticated, service_role;
revoke all on table public.chess_rating_events from public, anon, authenticated, service_role;
revoke all on table public.live_chess_matchmaking_tickets from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.student_chess_ratings to service_role;
grant select, insert, update, delete on table public.chess_rating_events to service_role;
grant select, insert, update, delete on table public.live_chess_matchmaking_tickets to service_role;

drop policy if exists "Student chess ratings are server-only" on public.student_chess_ratings;
create policy "Student chess ratings are server-only"
on public.student_chess_ratings for all to anon, authenticated
using (false) with check (false);

drop policy if exists "Chess rating events are server-only" on public.chess_rating_events;
create policy "Chess rating events are server-only"
on public.chess_rating_events for all to anon, authenticated
using (false) with check (false);

drop policy if exists "Live matchmaking tickets are server-only" on public.live_chess_matchmaking_tickets;
create policy "Live matchmaking tickets are server-only"
on public.live_chess_matchmaking_tickets for all to anon, authenticated
using (false) with check (false);

create or replace function public.set_student_chess_rating_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_live_matchmaking_ticket_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_student_chess_rating_updated_at() from public, anon, authenticated;
revoke all on function public.set_live_matchmaking_ticket_updated_at() from public, anon, authenticated;

drop trigger if exists set_student_chess_rating_updated_at on public.student_chess_ratings;
create trigger set_student_chess_rating_updated_at
before update on public.student_chess_ratings
for each row execute function public.set_student_chess_rating_updated_at();

drop trigger if exists set_live_matchmaking_ticket_updated_at on public.live_chess_matchmaking_tickets;
create trigger set_live_matchmaking_ticket_updated_at
before update on public.live_chess_matchmaking_tickets
for each row execute function public.set_live_matchmaking_ticket_updated_at();

insert into public.student_chess_ratings(student_id)
select id from public.students
where is_active = true
on conflict (student_id) do nothing;

create or replace function public.apply_live_chess_rating(p_game_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_game public.live_chess_games%rowtype;
  v_white public.student_chess_ratings%rowtype;
  v_black public.student_chess_ratings%rowtype;
  v_white_score numeric;
  v_black_score numeric;
  v_white_expected numeric;
  v_black_expected numeric;
  v_white_delta integer;
  v_black_delta integer;
  v_white_after integer;
  v_black_after integer;
begin
  select * into v_game
  from public.live_chess_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Live game not found.';
  end if;
  if v_game.status <> 'completed' or not v_game.rated then
    return jsonb_build_object('applied', false, 'reason', 'not_rated');
  end if;
  if v_game.rating_applied_at is not null then
    return jsonb_build_object('applied', false, 'reason', 'already_applied');
  end if;
  if v_game.white_player_id is null or v_game.black_player_id is null then
    raise exception 'Completed rated game is missing a player.';
  end if;

  insert into public.student_chess_ratings(student_id)
  values (v_game.white_player_id), (v_game.black_player_id)
  on conflict (student_id) do nothing;

  perform 1
  from public.student_chess_ratings
  where student_id in (v_game.white_player_id, v_game.black_player_id)
  order by student_id
  for update;

  select * into strict v_white from public.student_chess_ratings where student_id = v_game.white_player_id;
  select * into strict v_black from public.student_chess_ratings where student_id = v_game.black_player_id;

  v_white_score := case
    when v_game.winner_color = 'white' then 1.0
    when v_game.winner_color = 'black' then 0.0
    else 0.5
  end;
  v_black_score := 1.0 - v_white_score;
  v_white_expected := 1.0 / (1.0 + power(10.0, (v_black.rating - v_white.rating) / 400.0));
  v_black_expected := 1.0 - v_white_expected;
  v_white_delta := round((case when v_white.rated_games < 10 then 40 else 24 end) * (v_white_score - v_white_expected))::integer;
  v_black_delta := round((case when v_black.rated_games < 10 then 40 else 24 end) * (v_black_score - v_black_expected))::integer;
  v_white_after := greatest(100, least(3000, v_white.rating + v_white_delta));
  v_black_after := greatest(100, least(3000, v_black.rating + v_black_delta));

  update public.student_chess_ratings
  set rating = v_white_after,
      peak_rating = greatest(peak_rating, v_white_after),
      rated_games = rated_games + 1,
      wins = wins + case when v_white_score = 1.0 then 1 else 0 end,
      draws = draws + case when v_white_score = 0.5 then 1 else 0 end,
      losses = losses + case when v_white_score = 0.0 then 1 else 0 end,
      provisional = (rated_games + 1 < 10),
      version = version + 1
  where student_id = v_game.white_player_id;

  update public.student_chess_ratings
  set rating = v_black_after,
      peak_rating = greatest(peak_rating, v_black_after),
      rated_games = rated_games + 1,
      wins = wins + case when v_black_score = 1.0 then 1 else 0 end,
      draws = draws + case when v_black_score = 0.5 then 1 else 0 end,
      losses = losses + case when v_black_score = 0.0 then 1 else 0 end,
      provisional = (rated_games + 1 < 10),
      version = version + 1
  where student_id = v_game.black_player_id;

  insert into public.chess_rating_events(
    student_id, event_type, game_id, opponent_id, result,
    rating_before, rating_after, rating_change, reason, created_at
  ) values
  (
    v_game.white_player_id, 'game', v_game.id, v_game.black_player_id,
    case when v_white_score = 1.0 then 'win' when v_white_score = 0.5 then 'draw' else 'loss' end,
    v_white.rating, v_white_after, v_white_after - v_white.rating,
    coalesce(v_game.result_reason, 'completed game'), coalesce(v_game.completed_at, now())
  ),
  (
    v_game.black_player_id, 'game', v_game.id, v_game.white_player_id,
    case when v_black_score = 1.0 then 'win' when v_black_score = 0.5 then 'draw' else 'loss' end,
    v_black.rating, v_black_after, v_black_after - v_black.rating,
    coalesce(v_game.result_reason, 'completed game'), coalesce(v_game.completed_at, now())
  );

  update public.live_chess_games
  set rating_applied_at = now()
  where id = v_game.id;

  return jsonb_build_object(
    'applied', true,
    'whiteBefore', v_white.rating,
    'whiteAfter', v_white_after,
    'whiteChange', v_white_after - v_white.rating,
    'blackBefore', v_black.rating,
    'blackAfter', v_black_after,
    'blackChange', v_black_after - v_black.rating
  );
end;
$$;

create or replace function public.adjust_student_chess_rating(
  p_student_id uuid,
  p_new_rating integer,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rating public.student_chess_ratings%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if p_new_rating < 100 or p_new_rating > 3000 then
    raise exception 'Rating must be between 100 and 3000.';
  end if;
  if char_length(v_reason) < 3 or char_length(v_reason) > 500 then
    raise exception 'Add a moderation reason between 3 and 500 characters.';
  end if;
  if not exists (select 1 from public.students where id = p_student_id and is_active = true) then
    raise exception 'Active student not found.';
  end if;

  insert into public.student_chess_ratings(student_id)
  values (p_student_id)
  on conflict (student_id) do nothing;

  select * into strict v_rating
  from public.student_chess_ratings
  where student_id = p_student_id
  for update;

  update public.student_chess_ratings
  set rating = p_new_rating,
      peak_rating = greatest(peak_rating, p_new_rating),
      version = version + 1
  where student_id = p_student_id;

  insert into public.chess_rating_events(
    student_id, event_type, rating_before, rating_after, rating_change, reason
  ) values (
    p_student_id, 'admin', v_rating.rating, p_new_rating,
    p_new_rating - v_rating.rating, v_reason
  );

  return jsonb_build_object(
    'studentId', p_student_id,
    'ratingBefore', v_rating.rating,
    'ratingAfter', p_new_rating,
    'ratingChange', p_new_rating - v_rating.rating
  );
end;
$$;

create or replace function public.join_live_chess_matchmaking(
  p_student_id uuid,
  p_time_control_id text,
  p_time_control jsonb,
  p_initial_fen text,
  p_challenge_code text,
  p_rated boolean
)
returns table(ticket_id uuid, ticket_status text, game_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ticket_id uuid;
  v_candidate public.live_chess_matchmaking_tickets%rowtype;
  v_game_id uuid;
  v_rating integer;
  v_white_id uuid;
  v_black_id uuid;
  v_now timestamptz := now();
  v_initial_ms bigint;
begin
  if p_time_control_id not in ('10m', '10+5', '15+10') then
    raise exception 'Choose a timed matchmaking clock.';
  end if;
  if p_challenge_code !~ '^[A-HJ-NP-Z2-9]{12}$' then
    raise exception 'Invalid challenge code.';
  end if;
  if not exists (select 1 from public.students where id = p_student_id and is_active = true) then
    raise exception 'Active student not found.';
  end if;
  if exists (
    select 1 from public.live_chess_games
    where status = 'active'
      and (white_player_id = p_student_id or black_player_id = p_student_id)
  ) then
    raise exception 'Finish your active live game before joining matchmaking.';
  end if;

  update public.live_chess_matchmaking_tickets
  set status = 'expired'
  where status = 'waiting' and created_at < v_now - interval '10 minutes';

  update public.live_chess_matchmaking_tickets
  set status = 'cancelled'
  where student_id = p_student_id and status = 'waiting';

  insert into public.student_chess_ratings(student_id)
  values (p_student_id)
  on conflict (student_id) do nothing;
  select rating into strict v_rating
  from public.student_chess_ratings
  where student_id = p_student_id;

  insert into public.live_chess_matchmaking_tickets(
    student_id, time_control_id, rated, student_rating
  ) values (
    p_student_id, p_time_control_id, p_rated, v_rating
  ) returning id into v_ticket_id;

  select q.* into v_candidate
  from public.live_chess_matchmaking_tickets q
  where q.status = 'waiting'
    and q.id <> v_ticket_id
    and q.student_id <> p_student_id
    and q.time_control_id = p_time_control_id
    and q.rated = p_rated
    and q.created_at >= v_now - interval '10 minutes'
    and not exists (
      select 1 from public.live_chess_games g
      where g.status = 'active'
        and (g.white_player_id = q.student_id or g.black_player_id = q.student_id)
    )
  order by abs(q.student_rating - v_rating), q.created_at, q.id
  for update skip locked
  limit 1;

  if not found then
    return query select v_ticket_id, 'waiting'::text, null::uuid;
    return;
  end if;

  if random() < 0.5 then
    v_white_id := v_candidate.student_id;
    v_black_id := p_student_id;
  else
    v_white_id := p_student_id;
    v_black_id := v_candidate.student_id;
  end if;
  v_initial_ms := nullif(p_time_control ->> 'initialMs', '')::bigint;

  insert into public.live_chess_games(
    challenge_code, created_by, white_player_id, black_player_id, status,
    time_control_id, time_control, initial_fen, current_fen, active_color,
    white_ms, black_ms, clock_started_at, started_at, rated, matchmaking
  ) values (
    p_challenge_code, p_student_id, v_white_id, v_black_id, 'active',
    p_time_control_id, p_time_control, p_initial_fen, p_initial_fen, 'white',
    v_initial_ms, v_initial_ms, v_now, v_now, p_rated, true
  ) returning id into v_game_id;

  update public.live_chess_matchmaking_tickets
  set status = 'matched', matched_game_id = v_game_id
  where id in (v_ticket_id, v_candidate.id);

  return query select v_ticket_id, 'matched'::text, v_game_id;
end;
$$;

create or replace function public.request_live_chess_rematch(
  p_game_id uuid,
  p_student_id uuid,
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
  v_now timestamptz := now();
begin
  select * into v_game
  from public.live_chess_games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Live game not found.';
  end if;
  if v_game.status <> 'completed' then
    raise exception 'Rematches are available after the game is completed.';
  end if;
  if p_student_id <> v_game.white_player_id and p_student_id <> v_game.black_player_id then
    raise exception 'You are not a player in this game.';
  end if;
  if v_game.rematch_game_id is not null then
    return jsonb_build_object('status', 'matched', 'gameId', v_game.rematch_game_id);
  end if;
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
  if p_challenge_code !~ '^[A-HJ-NP-Z2-9]{12}$' then
    raise exception 'Invalid challenge code.';
  end if;
  if exists (
    select 1 from public.live_chess_games g
    where g.status = 'active'
      and g.id <> p_game_id
      and (
        g.white_player_id in (v_game.white_player_id, v_game.black_player_id)
        or g.black_player_id in (v_game.white_player_id, v_game.black_player_id)
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

revoke all on function public.apply_live_chess_rating(uuid) from public, anon, authenticated;
revoke all on function public.adjust_student_chess_rating(uuid, integer, text) from public, anon, authenticated;
revoke all on function public.join_live_chess_matchmaking(uuid, text, jsonb, text, text, boolean) from public, anon, authenticated;
revoke all on function public.request_live_chess_rematch(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.apply_live_chess_rating(uuid) to service_role;
grant execute on function public.adjust_student_chess_rating(uuid, integer, text) to service_role;
grant execute on function public.join_live_chess_matchmaking(uuid, text, jsonb, text, text, boolean) to service_role;
grant execute on function public.request_live_chess_rematch(uuid, uuid, text) to service_role;

comment on table public.student_chess_ratings is
  'One server-owned Academy PvP rating profile per student. The first ten rated games are provisional.';
comment on table public.chess_rating_events is
  'Immutable, idempotent rating ledger for completed rated games and documented teacher adjustments.';
comment on table public.live_chess_matchmaking_tickets is
  'Short-lived server-owned rated or casual queue tickets matched transactionally by clock and nearest rating.';
