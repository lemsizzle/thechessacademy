-- The Chess Academy Quest Board
-- Add Lichess identity fields to existing Supabase students table.
--
-- Safe to run after the original schema has already been created.
-- This script does not drop tables, delete rows, or truncate data.

alter table public.students
  add column if not exists lichess_id text;

alter table public.students
  add column if not exists lichess_username text;

create unique index if not exists students_lichess_id_key
  on public.students(lichess_id)
  where lichess_id is not null;

create unique index if not exists students_lichess_username_key
  on public.students(lower(lichess_username))
  where lichess_username is not null;
