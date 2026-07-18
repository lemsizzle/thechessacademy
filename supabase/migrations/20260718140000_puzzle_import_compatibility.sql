-- Safe compatibility migration for the repeatable Lichess puzzle importer.
-- The original puzzle-training migration already creates these fields; every
-- statement here is idempotent for projects that ran an earlier revision.

alter table public.chess_puzzles add column if not exists lichess_puzzle_id text;
alter table public.chess_puzzles add column if not exists initial_fen text;
alter table public.chess_puzzles add column if not exists moves text[] not null default '{}'::text[];
alter table public.chess_puzzles add column if not exists rating integer;
alter table public.chess_puzzles add column if not exists rating_deviation integer;
alter table public.chess_puzzles add column if not exists popularity integer;
alter table public.chess_puzzles add column if not exists number_of_plays integer;
alter table public.chess_puzzles add column if not exists themes text[] not null default '{}'::text[];
alter table public.chess_puzzles add column if not exists game_url text;
alter table public.chess_puzzles add column if not exists opening_tags text[] not null default '{}'::text[];
alter table public.chess_puzzles add column if not exists random_key double precision not null default random();
alter table public.chess_puzzles add column if not exists is_active boolean not null default true;
alter table public.chess_puzzles add column if not exists created_at timestamptz not null default now();
alter table public.chess_puzzles add column if not exists updated_at timestamptz not null default now();

create unique index if not exists chess_puzzles_lichess_puzzle_id_key
on public.chess_puzzles(lichess_puzzle_id);

create index if not exists chess_puzzles_themes_gin_idx
on public.chess_puzzles using gin(themes);

create index if not exists chess_puzzles_rating_idx
on public.chess_puzzles(rating);

create index if not exists chess_puzzles_active_random_idx
on public.chess_puzzles(is_active, random_key);
