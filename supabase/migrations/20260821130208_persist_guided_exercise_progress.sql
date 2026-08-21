-- Persist server-verified Study exercise attempts and allow teacher-authored
-- Study positions to join the existing Puzzle Training catalog.

alter table public.chess_puzzles
  add column if not exists start_mode text not null default 'after_setup',
  add column if not exists accepted_moves text[] not null default '{}'::text[],
  add column if not exists source_kind text not null default 'lichess',
  add column if not exists source_study_id uuid references public.chess_studies(id) on delete set null,
  add column if not exists source_chapter_id uuid references public.chess_study_chapters(id) on delete set null,
  add column if not exists source_node_id text,
  add column if not exists teacher_prompt text not null default '';

alter table public.chess_puzzles
  drop constraint if exists chess_puzzles_moves_valid;
alter table public.chess_puzzles
  add constraint chess_puzzles_moves_valid check (
    (start_mode = 'after_setup' and cardinality(moves) >= 2 and mod(cardinality(moves), 2) = 0)
    or
    (start_mode = 'direct' and cardinality(moves) >= 1 and mod(cardinality(moves), 2) = 1)
  ),
  add constraint chess_puzzles_start_mode_valid check (start_mode in ('after_setup', 'direct')),
  add constraint chess_puzzles_source_kind_valid check (source_kind in ('lichess', 'study')),
  add constraint chess_puzzles_accepted_moves_valid check (cardinality(accepted_moves) <= 8),
  add constraint chess_puzzles_teacher_prompt_length check (char_length(teacher_prompt) <= 500);

create unique index if not exists chess_puzzles_study_position_key
  on public.chess_puzzles(source_study_id, source_chapter_id, source_node_id)
  where source_kind = 'study' and source_study_id is not null and source_chapter_id is not null and source_node_id is not null;
create index if not exists chess_puzzles_source_study_idx
  on public.chess_puzzles(source_study_id, source_chapter_id)
  where source_kind = 'study';

create table if not exists public.chess_guided_exercise_attempts (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.chess_studies(id) on delete cascade,
  chapter_id uuid not null references public.chess_study_chapters(id) on delete cascade,
  node_id text not null,
  student_id uuid not null references public.students(id) on delete cascade,
  attempted_uci text not null,
  attempted_san text not null,
  correct boolean not null,
  exercise_prompt text not null,
  attempted_at timestamptz not null default now(),
  constraint chess_guided_attempt_node_length check (char_length(node_id) between 1 and 200),
  constraint chess_guided_attempt_uci_valid check (attempted_uci ~ '^[a-h][1-8][a-h][1-8][qrbn]?$'),
  constraint chess_guided_attempt_san_length check (char_length(attempted_san) between 1 and 40),
  constraint chess_guided_attempt_prompt_length check (char_length(exercise_prompt) between 1 and 500)
);

create index if not exists chess_guided_attempts_study_time_idx
  on public.chess_guided_exercise_attempts(study_id, attempted_at desc);
create index if not exists chess_guided_attempts_student_time_idx
  on public.chess_guided_exercise_attempts(student_id, attempted_at desc);
create index if not exists chess_guided_attempts_position_idx
  on public.chess_guided_exercise_attempts(study_id, chapter_id, node_id, student_id);

alter table public.chess_guided_exercise_attempts enable row level security;

revoke all on table public.chess_guided_exercise_attempts from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.chess_guided_exercise_attempts to service_role;

drop policy if exists "Guided exercise attempts are server-only" on public.chess_guided_exercise_attempts;
create policy "Guided exercise attempts are server-only"
on public.chess_guided_exercise_attempts for all to anon, authenticated
using (false) with check (false);

comment on table public.chess_guided_exercise_attempts is 'Server-verified student attempts on position-level Study exercises.';
comment on column public.chess_puzzles.start_mode is 'after_setup for imported Lichess lines; direct for teacher-authored Study positions.';
