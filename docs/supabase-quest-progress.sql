-- The Chess Academy Quest Board
-- Durable Lichess quest progress tables
--
-- Run this in Supabase SQL Editor after the main schema.
-- It does not drop or delete existing data.

create table if not exists public.student_quest_attempts (
  id text primary key,
  student_id uuid references public.students(id) on delete cascade,
  quest_id text not null,
  started_at timestamptz not null,
  expires_at timestamptz not null,
  status text default 'active',
  created_at timestamptz default now(),
  unique(student_id, quest_id, started_at, expires_at)
);

create table if not exists public.lichess_quest_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  quest_id text not null,
  source_period_start timestamptz not null,
  source_period_end timestamptz not null,
  current_value integer default 0,
  required_value integer default 1,
  accuracy integer,
  completed boolean default false,
  evidence text,
  mode text default 'connected',
  updated_at timestamptz default now(),
  unique(student_id, quest_id, source_period_start, source_period_end)
);

create table if not exists public.quest_completion_events (
  id text primary key,
  student_id uuid references public.students(id) on delete cascade,
  quest_id text not null,
  award_id text not null,
  completed_at timestamptz default now(),
  source text not null,
  source_period_start timestamptz not null,
  source_period_end timestamptz not null,
  xp_awarded integer default 0,
  badge_awarded_id text,
  evidence text
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'student_quest_attempts_status_valid'
      and conrelid = 'public.student_quest_attempts'::regclass
  ) then
    alter table public.student_quest_attempts
      add constraint student_quest_attempts_status_valid
      check (status in ('active', 'expired', 'completed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'lichess_quest_progress_mode_valid'
      and conrelid = 'public.lichess_quest_progress'::regclass
  ) then
    alter table public.lichess_quest_progress
      add constraint lichess_quest_progress_mode_valid
      check (mode in ('connected', 'mock'));
  end if;
end;
$$;

create index if not exists student_quest_attempts_student_idx on public.student_quest_attempts(student_id);
create index if not exists student_quest_attempts_quest_idx on public.student_quest_attempts(quest_id);
create index if not exists student_quest_attempts_status_idx on public.student_quest_attempts(status);

create index if not exists lichess_quest_progress_student_idx on public.lichess_quest_progress(student_id);
create index if not exists lichess_quest_progress_quest_idx on public.lichess_quest_progress(quest_id);
create index if not exists lichess_quest_progress_completed_idx on public.lichess_quest_progress(completed);

create index if not exists quest_completion_events_student_idx on public.quest_completion_events(student_id);
create index if not exists quest_completion_events_quest_idx on public.quest_completion_events(quest_id);
create index if not exists quest_completion_events_completed_at_idx on public.quest_completion_events(completed_at desc);

alter table public.student_quest_attempts enable row level security;
alter table public.lichess_quest_progress enable row level security;
alter table public.quest_completion_events enable row level security;

drop policy if exists "Public can read active student quest attempts" on public.student_quest_attempts;
drop policy if exists "Public can read active lichess quest progress" on public.lichess_quest_progress;
drop policy if exists "Public can read active quest completions" on public.quest_completion_events;

create policy "Public can read active student quest attempts"
on public.student_quest_attempts
for select
to anon, authenticated
using (
  exists (
    select 1 from public.students
    where students.id = student_quest_attempts.student_id
      and students.is_active = true
  )
);

create policy "Public can read active lichess quest progress"
on public.lichess_quest_progress
for select
to anon, authenticated
using (
  exists (
    select 1 from public.students
    where students.id = lichess_quest_progress.student_id
      and students.is_active = true
  )
);

create policy "Public can read active quest completions"
on public.quest_completion_events
for select
to anon, authenticated
using (
  exists (
    select 1 from public.students
    where students.id = quest_completion_events.student_id
      and students.is_active = true
  )
);
