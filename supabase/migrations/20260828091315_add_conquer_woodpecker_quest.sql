-- Schema support for a server-verified Woodpecker set. The quest is activated
-- separately after compatible application code is deployed.

alter table public.student_puzzle_attempts
  add column if not exists woodpecker_run_id uuid,
  add column if not exists woodpecker_cycle_number smallint;

alter table public.student_puzzle_attempts
  drop constraint if exists student_puzzle_attempts_woodpecker_run_valid;

alter table public.student_puzzle_attempts
  add constraint student_puzzle_attempts_woodpecker_run_valid check (
    (woodpecker_run_id is null and woodpecker_cycle_number is null)
    or (
      training_mode = 'woodpecker'
      and woodpecker_run_id is not null
      and woodpecker_cycle_number between 1 and 3
    )
  );

create index if not exists student_puzzle_attempts_woodpecker_run_idx
  on public.student_puzzle_attempts (
    student_id,
    woodpecker_run_id,
    woodpecker_cycle_number,
    session_id
  )
  include (puzzle_id, solved, selected_theme, attempted_at, completed_at)
  where woodpecker_run_id is not null;

create or replace function public.prevent_woodpecker_attempt_rebinding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.woodpecker_run_id is not null
    and (
      new.woodpecker_run_id is distinct from old.woodpecker_run_id
      or new.woodpecker_cycle_number is distinct from old.woodpecker_cycle_number
    ) then
    raise exception 'Woodpecker attempt metadata is immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_woodpecker_attempt_rebinding
  on public.student_puzzle_attempts;
create trigger prevent_woodpecker_attempt_rebinding
before update of woodpecker_run_id, woodpecker_cycle_number
on public.student_puzzle_attempts
for each row execute function public.prevent_woodpecker_attempt_rebinding();

revoke all on function public.prevent_woodpecker_attempt_rebinding()
  from public, anon, authenticated;
grant execute on function public.prevent_woodpecker_attempt_rebinding()
  to service_role;

alter table public.student_woodpecker_cycle_results
  add column if not exists run_id uuid,
  add column if not exists cycle_number smallint;

alter table public.student_woodpecker_cycle_results
  drop constraint if exists student_woodpecker_cycle_results_run_valid;

alter table public.student_woodpecker_cycle_results
  add constraint student_woodpecker_cycle_results_run_valid check (
    (run_id is null and cycle_number is null)
    or (run_id is not null and cycle_number between 1 and 3)
  );

create unique index if not exists student_woodpecker_cycle_results_run_cycle_key
  on public.student_woodpecker_cycle_results (student_id, run_id, cycle_number)
  where run_id is not null;

create or replace function public.prevent_woodpecker_cycle_rebinding()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.run_id is not null
    and (
      new.run_id is distinct from old.run_id
      or new.cycle_number is distinct from old.cycle_number
    ) then
    raise exception 'Woodpecker cycle metadata is immutable.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_woodpecker_cycle_rebinding
  on public.student_woodpecker_cycle_results;
create trigger prevent_woodpecker_cycle_rebinding
before update of run_id, cycle_number
on public.student_woodpecker_cycle_results
for each row execute function public.prevent_woodpecker_cycle_rebinding();

revoke all on function public.prevent_woodpecker_cycle_rebinding()
  from public, anon, authenticated;
grant execute on function public.prevent_woodpecker_cycle_rebinding()
  to service_role;

create table if not exists public.student_woodpecker_set_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  run_id uuid not null,
  cycle_session_ids uuid[] not null check (cardinality(cycle_session_ids) = 3),
  cycle_sessions_hash text not null check (char_length(cycle_sessions_hash) = 64),
  puzzle_set_hash text not null check (char_length(puzzle_set_hash) = 64),
  selected_theme text not null default 'mixed',
  set_size smallint not null check (set_size = 20),
  cycle_count smallint not null check (cycle_count = 3),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint student_woodpecker_set_results_time_valid check (started_at <= completed_at),
  unique (student_id, run_id),
  unique (student_id, cycle_sessions_hash)
);

comment on table public.student_woodpecker_set_results is
  'Server-verified completion records for all three cycles of one 20-puzzle Woodpecker set.';

create index if not exists student_woodpecker_set_results_student_window_idx
  on public.student_woodpecker_set_results (student_id, started_at, completed_at);

alter table public.student_woodpecker_set_results enable row level security;

revoke all on table public.student_woodpecker_set_results
  from public, anon, authenticated;
grant select, insert, update, delete
  on table public.student_woodpecker_set_results to service_role;

drop policy if exists "No direct access to Woodpecker set results"
  on public.student_woodpecker_set_results;
create policy "No direct access to Woodpecker set results"
on public.student_woodpecker_set_results
for all
to anon, authenticated
using (false)
with check (false);
