-- Distinguish a legitimate zero-point result from no Hide and Seek attempt in
-- each leaderboard window. Recreate the reporting function atomically because
-- PostgreSQL cannot replace a function while changing its returned columns.

drop function if exists public.get_hide_and_seek_leaderboard();

create function public.get_hide_and_seek_leaderboard()
returns table (
  student_id uuid,
  all_time_score integer,
  month_score integer,
  week_score integer,
  all_time_attempts bigint,
  month_attempts bigint,
  week_attempts bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    attempt.student_id,
    max(attempt.score)::integer as all_time_score,
    coalesce(
      max(attempt.score) filter (where attempt.completed_at >= now() - interval '30 days'),
      0
    )::integer as month_score,
    coalesce(
      max(attempt.score) filter (where attempt.completed_at >= now() - interval '7 days'),
      0
    )::integer as week_score,
    count(*) as all_time_attempts,
    count(*) filter (where attempt.completed_at >= now() - interval '30 days') as month_attempts,
    count(*) filter (where attempt.completed_at >= now() - interval '7 days') as week_attempts
  from public.student_hide_and_seek_attempts as attempt
  group by attempt.student_id;
$$;

revoke all on function public.get_hide_and_seek_leaderboard()
  from public, anon, authenticated, service_role;
grant execute on function public.get_hide_and_seek_leaderboard() to service_role;

comment on function public.get_hide_and_seek_leaderboard() is
  'Service-role-only Hide and Seek scores and attempt presence for teacher leaderboard windows.';
