-- The Chess Academy Quest Board
-- Student submissions persistence
--
-- Run this once in Supabase SQL Editor.
-- Safe for an existing project: it does not drop or delete data.

create table if not exists public.student_game_submissions (
  id text primary key,
  student_id uuid references public.students(id) on delete cascade,
  game_url text not null,
  platform text default 'lichess',
  lichess_game_id text not null,
  played_as text default 'unknown',
  game_type text,
  opponent_name text,
  notes text,
  status text default 'pending',
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  teacher_note text,
  rejection_reason text,
  linked_analysis_request_id text
);

create table if not exists public.student_score_submissions (
  id text primary key,
  student_id uuid references public.students(id) on delete cascade,
  challenge_name text not null,
  tactic_theme text not null,
  score integer default 0,
  total_questions integer,
  time_limit text,
  platform text,
  screenshot_url text,
  notes text,
  status text default 'pending',
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by text,
  teacher_note text,
  rejection_reason text,
  xp_awarded integer,
  tactic_progress_added integer
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'student_game_submissions_status_valid'
      and conrelid = 'public.student_game_submissions'::regclass
  ) then
    alter table public.student_game_submissions
      add constraint student_game_submissions_status_valid
      check (status in ('pending', 'approved', 'rejected', 'needs_changes'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'student_game_submissions_played_as_valid'
      and conrelid = 'public.student_game_submissions'::regclass
  ) then
    alter table public.student_game_submissions
      add constraint student_game_submissions_played_as_valid
      check (played_as in ('white', 'black', 'unknown'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'student_score_submissions_status_valid'
      and conrelid = 'public.student_score_submissions'::regclass
  ) then
    alter table public.student_score_submissions
      add constraint student_score_submissions_status_valid
      check (status in ('pending', 'approved', 'rejected', 'needs_changes'));
  end if;
end;
$$;

create index if not exists student_game_submissions_student_idx on public.student_game_submissions(student_id);
create index if not exists student_game_submissions_status_idx on public.student_game_submissions(status);
create index if not exists student_game_submissions_submitted_at_idx on public.student_game_submissions(submitted_at desc);

create index if not exists student_score_submissions_student_idx on public.student_score_submissions(student_id);
create index if not exists student_score_submissions_status_idx on public.student_score_submissions(status);
create index if not exists student_score_submissions_submitted_at_idx on public.student_score_submissions(submitted_at desc);

alter table public.student_game_submissions enable row level security;
alter table public.student_score_submissions enable row level security;

drop policy if exists "Public can read active student game submissions" on public.student_game_submissions;
drop policy if exists "Public can read active student score submissions" on public.student_score_submissions;

create policy "Public can read active student game submissions"
on public.student_game_submissions
for select
to anon, authenticated
using (
  exists (
    select 1 from public.students
    where students.id = student_game_submissions.student_id
      and students.is_active = true
  )
);

create policy "Public can read active student score submissions"
on public.student_score_submissions
for select
to anon, authenticated
using (
  exists (
    select 1 from public.students
    where students.id = student_score_submissions.student_id
      and students.is_active = true
  )
);
