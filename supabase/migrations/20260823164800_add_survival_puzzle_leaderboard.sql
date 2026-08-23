alter table public.student_puzzle_attempts
  add column if not exists training_mode text not null default 'legacy';

alter table public.student_puzzle_attempts
  drop constraint if exists student_puzzle_attempts_training_mode_valid;

alter table public.student_puzzle_attempts
  add constraint student_puzzle_attempts_training_mode_valid
  check (training_mode in ('legacy', 'survival', 'woodpecker', 'daily'));

comment on column public.student_puzzle_attempts.training_mode is
  'Server-verified puzzle mode used for mode-specific progress and leaderboards.';

create index if not exists student_puzzle_attempts_survival_runs_idx
  on public.student_puzzle_attempts (student_id, session_id, attempted_at)
  include (solved)
  where training_mode = 'survival';

create or replace function public.get_survival_puzzle_leaderboard()
returns table (
  student_id uuid,
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
      min(attempt.attempted_at) as started_at,
      count(*) filter (where attempt.solved) as score
    from public.student_puzzle_attempts as attempt
    where attempt.training_mode = 'survival'
    group by attempt.student_id, attempt.session_id
  )
  select
    run.student_id,
    max(run.score) as all_time_score,
    coalesce(max(run.score) filter (where run.started_at >= now() - interval '30 days'), 0) as month_score,
    coalesce(max(run.score) filter (where run.started_at >= now() - interval '7 days'), 0) as week_score
  from survival_runs as run
  group by run.student_id;
$$;

revoke all on function public.get_survival_puzzle_leaderboard() from public, anon, authenticated;
grant execute on function public.get_survival_puzzle_leaderboard() to service_role;
