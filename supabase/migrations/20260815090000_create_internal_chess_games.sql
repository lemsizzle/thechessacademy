-- Completed internal Chess Academy games. Student identity is verified by the
-- Next.js Lichess-session route, so browser roles have no direct table access.

create extension if not exists pgcrypto;

create table if not exists public.internal_chess_games (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.students(id) on delete cascade,
  opponent_type text not null default 'computer',
  opponent_id text not null,
  opponent_name text not null,
  player_color text not null,
  result text not null,
  result_reason text not null,
  winner_color text,
  time_control jsonb not null,
  initial_fen text not null,
  final_fen text not null,
  pgn text not null,
  moves jsonb not null default '[]'::jsonb,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint internal_chess_games_opponent_type_valid check (opponent_type in ('computer')),
  constraint internal_chess_games_player_color_valid check (player_color in ('white', 'black')),
  constraint internal_chess_games_result_valid check (result in ('win', 'loss', 'draw')),
  constraint internal_chess_games_result_reason_valid check (result_reason in (
    'checkmate', 'stalemate', 'resignation', 'timeout', 'threefold_repetition',
    'fifty_move_rule', 'insufficient_material', 'draw'
  )),
  constraint internal_chess_games_winner_color_valid check (winner_color is null or winner_color in ('white', 'black')),
  constraint internal_chess_games_moves_array check (jsonb_typeof(moves) = 'array'),
  constraint internal_chess_games_time_control_object check (jsonb_typeof(time_control) = 'object'),
  constraint internal_chess_games_time_valid check (completed_at >= started_at)
);

create index if not exists internal_chess_games_player_completed_idx
  on public.internal_chess_games(player_id, completed_at desc);

alter table public.internal_chess_games enable row level security;

revoke all on table public.internal_chess_games from public, anon, authenticated, service_role;
grant select, insert on table public.internal_chess_games to service_role;

drop policy if exists "Internal chess games are server-only" on public.internal_chess_games;
create policy "Internal chess games are server-only"
on public.internal_chess_games for all to anon, authenticated
using (false) with check (false);

comment on table public.internal_chess_games is
  'Completed Chess Academy games saved by authenticated server routes. Includes replayable moves, FEN, and PGN.';
