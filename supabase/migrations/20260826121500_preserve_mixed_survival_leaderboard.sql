create or replace function public.get_survival_puzzle_leaderboard_by_theme()
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

revoke all on function public.get_survival_puzzle_leaderboard_by_theme() from public, anon, authenticated;
grant execute on function public.get_survival_puzzle_leaderboard_by_theme() to service_role;

drop function if exists public.get_survival_puzzle_leaderboard();

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
