-- Production puzzle training tables.
-- Students authenticate through the app's Lichess session cookie, so these
-- tables are intentionally private to server-side service-role routes.

create extension if not exists pgcrypto;

create table if not exists public.chess_puzzles (
  id uuid primary key default gen_random_uuid(),
  lichess_puzzle_id text unique not null,
  initial_fen text not null,
  moves text[] not null,
  rating integer,
  rating_deviation integer,
  popularity integer,
  number_of_plays integer,
  themes text[] not null default '{}'::text[],
  game_url text,
  opening_tags text[] not null default '{}'::text[],
  random_key double precision not null default random(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chess_puzzles_moves_valid check (cardinality(moves) >= 2),
  constraint chess_puzzles_rating_valid check (rating is null or rating > 0),
  constraint chess_puzzles_random_key_valid check (random_key >= 0 and random_key < 1)
);

create table if not exists public.student_puzzle_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  puzzle_id uuid not null references public.chess_puzzles(id) on delete restrict,
  session_id uuid not null,
  selected_theme text not null,
  solved boolean not null default false,
  first_try_correct boolean not null default false,
  incorrect_move_count integer not null default 0,
  elapsed_seconds integer not null default 0,
  hints_used integer not null default 0,
  attempted_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint student_puzzle_attempts_theme_valid check (selected_theme in ('mixed', 'fork', 'pin', 'skewer', 'mateIn1')),
  constraint student_puzzle_attempts_incorrect_nonnegative check (incorrect_move_count >= 0),
  constraint student_puzzle_attempts_elapsed_nonnegative check (elapsed_seconds >= 0),
  constraint student_puzzle_attempts_hints_nonnegative check (hints_used >= 0),
  unique (student_id, puzzle_id, session_id)
);

create index if not exists chess_puzzles_rating_idx on public.chess_puzzles(rating);
create index if not exists chess_puzzles_active_random_idx on public.chess_puzzles(is_active, random_key);
create index if not exists chess_puzzles_themes_gin_idx on public.chess_puzzles using gin(themes);
create index if not exists student_puzzle_attempts_student_time_idx on public.student_puzzle_attempts(student_id, attempted_at desc);
create index if not exists student_puzzle_attempts_puzzle_idx on public.student_puzzle_attempts(puzzle_id);
create index if not exists student_puzzle_attempts_session_idx on public.student_puzzle_attempts(student_id, session_id);

create or replace function public.set_puzzle_training_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_chess_puzzles_updated_at on public.chess_puzzles;
create trigger set_chess_puzzles_updated_at
before update on public.chess_puzzles
for each row execute function public.set_puzzle_training_updated_at();

alter table public.chess_puzzles enable row level security;
alter table public.student_puzzle_attempts enable row level security;

-- New Supabase projects no longer expose tables automatically, but older
-- projects may retain broad default grants. Revoke them explicitly.
revoke all on table public.chess_puzzles from anon, authenticated;
revoke all on table public.student_puzzle_attempts from anon, authenticated;
revoke all on table public.chess_puzzles from service_role;
revoke all on table public.student_puzzle_attempts from service_role;
grant select, insert, update, delete on table public.chess_puzzles to service_role;
grant select, insert, update, delete on table public.student_puzzle_attempts to service_role;

drop policy if exists "Puzzle catalog is server-only" on public.chess_puzzles;
create policy "Puzzle catalog is server-only"
on public.chess_puzzles for all to anon, authenticated
using (false) with check (false);

drop policy if exists "Puzzle attempts are server-only" on public.student_puzzle_attempts;
create policy "Puzzle attempts are server-only"
on public.student_puzzle_attempts for all to anon, authenticated
using (false) with check (false);

comment on table public.chess_puzzles is 'Curated official Lichess open-database puzzles. Answers remain server-side.';
comment on table public.student_puzzle_attempts is 'Server-verified Chess Academy puzzle training attempts.';
