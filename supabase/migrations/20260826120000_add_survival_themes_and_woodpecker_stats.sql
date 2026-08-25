drop function if exists public.get_survival_puzzle_leaderboard();

create or replace function public.get_survival_puzzle_leaderboard()
returns table (
  student_id uuid,
  theme text,
  all_time_score bigint,
  month_score bigint,
  week_score bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with survival_runs as (
    select
      attempt.student_id,
      attempt.session_id,
      attempt.selected_theme,
      min(attempt.attempted_at) as started_at,
      count(*) filter (where attempt.solved) as score
    from public.student_puzzle_attempts as attempt
    where attempt.training_mode = 'survival'
    group by attempt.student_id, attempt.session_id, attempt.selected_theme
  ), theme_scores as (
    select
      run.student_id,
      run.selected_theme as theme,
      max(run.score) as all_time_score,
      coalesce(max(run.score) filter (where run.started_at >= now() - interval '30 days'), 0) as month_score,
      coalesce(max(run.score) filter (where run.started_at >= now() - interval '7 days'), 0) as week_score
    from survival_runs as run
    where run.selected_theme <> 'mixed'
    group by run.student_id, run.selected_theme
  ), mixed_scores as (
    select
      run.student_id,
      'mixed'::text as theme,
      max(run.score) as all_time_score,
      coalesce(max(run.score) filter (where run.started_at >= now() - interval '30 days'), 0) as month_score,
      coalesce(max(run.score) filter (where run.started_at >= now() - interval '7 days'), 0) as week_score
    from survival_runs as run
    group by run.student_id
  )
  select * from mixed_scores
  union all
  select * from theme_scores;
$$;

revoke all on function public.get_survival_puzzle_leaderboard() from public, anon, authenticated;
grant execute on function public.get_survival_puzzle_leaderboard() to service_role;

create index if not exists student_puzzle_attempts_survival_theme_runs_idx
  on public.student_puzzle_attempts (selected_theme, student_id, session_id, attempted_at)
  include (solved)
  where training_mode = 'survival';

create table if not exists public.student_woodpecker_cycle_results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  session_id uuid not null,
  selected_theme text not null default 'mixed',
  set_size integer not null check (set_size in (20, 30, 40, 50)),
  incorrect_moves integer not null check (incorrect_moves >= 0),
  elapsed_seconds integer not null check (elapsed_seconds >= 0),
  puzzles_per_minute numeric(8, 1) not null check (puzzles_per_minute >= 0),
  accuracy smallint not null check (accuracy between 0 and 100),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (student_id, session_id)
);

comment on table public.student_woodpecker_cycle_results is
  'Server-verified speed and accuracy for fully completed Woodpecker cycles.';

alter table public.student_woodpecker_cycle_results enable row level security;

revoke all on table public.student_woodpecker_cycle_results from public, anon, authenticated;
grant select, insert, update, delete on table public.student_woodpecker_cycle_results to service_role;

create index if not exists student_woodpecker_cycle_results_latest_idx
  on public.student_woodpecker_cycle_results (student_id, completed_at desc);

insert into public.student_woodpecker_cycle_results (
  student_id,
  session_id,
  selected_theme,
  set_size,
  incorrect_moves,
  elapsed_seconds,
  puzzles_per_minute,
  accuracy,
  completed_at
)
select
  attempt.student_id,
  attempt.session_id,
  min(attempt.selected_theme) as selected_theme,
  count(*)::integer as set_size,
  sum(greatest(attempt.incorrect_move_count, 0))::integer as incorrect_moves,
  sum(greatest(attempt.elapsed_seconds, 0))::integer as elapsed_seconds,
  round((count(*) * 60.0 / greatest(sum(greatest(attempt.elapsed_seconds, 0)), 1))::numeric, 1) as puzzles_per_minute,
  round((count(*) * 100.0 / greatest(count(*) + sum(greatest(attempt.incorrect_move_count, 0)), 1))::numeric)::smallint as accuracy,
  max(coalesce(attempt.completed_at, attempt.attempted_at)) as completed_at
from public.student_puzzle_attempts as attempt
where attempt.training_mode = 'woodpecker'
group by attempt.student_id, attempt.session_id
having count(*) filter (where attempt.solved) = count(*)
  and count(*) in (20, 30, 40, 50)
on conflict (student_id, session_id) do nothing;
