-- Server-authoritative student-vs-student games. Browser database roles never
-- receive table access; authenticated Next.js routes validate every action.

create table if not exists public.live_chess_games (
  id uuid primary key default gen_random_uuid(),
  challenge_code text not null unique,
  realtime_token uuid not null default gen_random_uuid(),
  created_by uuid not null references public.students(id) on delete cascade,
  white_player_id uuid references public.students(id) on delete cascade,
  black_player_id uuid references public.students(id) on delete cascade,
  status text not null default 'waiting',
  time_control_id text not null,
  time_control jsonb not null,
  initial_fen text not null,
  current_fen text not null,
  moves jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  active_color text not null default 'white',
  white_ms bigint,
  black_ms bigint,
  clock_started_at timestamptz,
  draw_offered_by uuid references public.students(id) on delete set null,
  winner_color text,
  result_reason text,
  pgn text not null default '',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_chess_games_code_format check (challenge_code ~ '^[A-HJ-NP-Z2-9]{12}$'),
  constraint live_chess_games_status_valid check (status in ('waiting', 'active', 'completed', 'cancelled')),
  constraint live_chess_games_time_control_id_valid check (time_control_id in ('none', '10m', '10+5', '15+10')),
  constraint live_chess_games_time_control_object check (jsonb_typeof(time_control) = 'object'),
  constraint live_chess_games_moves_array check (jsonb_typeof(moves) = 'array'),
  constraint live_chess_games_version_positive check (version > 0),
  constraint live_chess_games_active_color_valid check (active_color in ('white', 'black')),
  constraint live_chess_games_winner_color_valid check (winner_color is null or winner_color in ('white', 'black')),
  constraint live_chess_games_result_reason_valid check (result_reason is null or result_reason in (
    'checkmate', 'stalemate', 'resignation', 'timeout', 'threefold_repetition',
    'fifty_move_rule', 'insufficient_material', 'draw'
  )),
  constraint live_chess_games_players_distinct check (
    white_player_id is null or black_player_id is null or white_player_id <> black_player_id
  ),
  constraint live_chess_games_creator_is_player check (
    created_by = white_player_id or created_by = black_player_id
  ),
  constraint live_chess_games_draw_offer_player check (
    draw_offered_by is null or draw_offered_by = white_player_id or draw_offered_by = black_player_id
  ),
  constraint live_chess_games_clock_pair check (
    (white_ms is null and black_ms is null) or (white_ms is not null and black_ms is not null and white_ms >= 0 and black_ms >= 0)
  ),
  constraint live_chess_games_status_shape check (
    (status = 'waiting' and (white_player_id is null or black_player_id is null) and started_at is null and completed_at is null)
    or (status = 'active' and white_player_id is not null and black_player_id is not null and started_at is not null and completed_at is null)
    or (status = 'completed' and white_player_id is not null and black_player_id is not null and started_at is not null and completed_at is not null and result_reason is not null)
    or (status = 'cancelled' and completed_at is not null)
  )
);

create index if not exists live_chess_games_white_status_updated_idx
  on public.live_chess_games(white_player_id, status, updated_at desc);
create index if not exists live_chess_games_black_status_updated_idx
  on public.live_chess_games(black_player_id, status, updated_at desc);
create index if not exists live_chess_games_created_by_status_idx
  on public.live_chess_games(created_by, status, updated_at desc);
create index if not exists live_chess_games_draw_offered_by_idx
  on public.live_chess_games(draw_offered_by) where draw_offered_by is not null;

alter table public.live_chess_games enable row level security;
revoke all on table public.live_chess_games from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.live_chess_games to service_role;

drop policy if exists "Live chess games are server-only" on public.live_chess_games;
create policy "Live chess games are server-only"
on public.live_chess_games for all to anon, authenticated
using (false) with check (false);

create or replace function public.set_live_chess_game_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_live_chess_game_updated_at() from public, anon, authenticated;

drop trigger if exists set_live_chess_game_updated_at on public.live_chess_games;
create trigger set_live_chess_game_updated_at
before update on public.live_chess_games
for each row execute function public.set_live_chess_game_updated_at();

-- Only a minimal invalidation message is broadcast. The full game snapshot is
-- always re-fetched through an authenticated server route.
create or replace function public.broadcast_live_chess_game_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'gameId', new.id,
      'version', new.version,
      'status', new.status,
      'updatedAt', new.updated_at
    ),
    'game_changed',
    'live-game:' || new.id::text || ':' || new.realtime_token::text,
    false
  );
  return null;
end;
$$;

revoke all on function public.broadcast_live_chess_game_change() from public, anon, authenticated;

drop trigger if exists broadcast_live_chess_game_change on public.live_chess_games;
create trigger broadcast_live_chess_game_change
after insert or update on public.live_chess_games
for each row execute function public.broadcast_live_chess_game_change();

alter table public.internal_chess_games
  drop constraint if exists internal_chess_games_opponent_type_valid;
alter table public.internal_chess_games
  add constraint internal_chess_games_opponent_type_valid
  check (opponent_type in ('computer', 'student'));

alter table public.internal_chess_games
  add column if not exists source_live_game_id uuid references public.live_chess_games(id) on delete set null;

create unique index if not exists internal_chess_games_live_player_unique
  on public.internal_chess_games(source_live_game_id, player_id)
  where source_live_game_id is not null;

create index if not exists internal_chess_games_source_live_game_idx
  on public.internal_chess_games(source_live_game_id)
  where source_live_game_id is not null;

comment on table public.live_chess_games is
  'Server-authoritative private student challenges with resumable clocks and realtime invalidation broadcasts.';
comment on column public.live_chess_games.realtime_token is
  'High-entropy capability used only to derive a public Realtime topic returned to participating students.';
